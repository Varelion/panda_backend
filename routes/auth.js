const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");
const Account = require("../models/User");
const logger = require("../utils/logger");
const rateLimiter = require("../middleware/rateLimiter");

const router = express.Router();

// Sign up
router.post("/signup", rateLimiter.auth(), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    // Check if username already exists
    const existingUsername = await Account.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Check if email already exists (only if email is provided)
    if (email) {
      const existingEmail = await Account.findByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
    }

    // Create user with password (will be hashed by model hook)
    const plaintext = password;

    // Create user
    const user = await Account.create({
      username,
      email,
      password: plaintext,
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email || null,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      }
    );

    logger.accountCreated(user.id, user.username, user.email, req.ip);

    res.status(201).json({
      message: "User created successfully",
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    logger.error("Signup error", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Sign in
router.post("/signin", rateLimiter.auth(), async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Accept either email or username
    const loginField = email || username;

    // Validate input
    if (!loginField || !password) {
      return res
        .status(400)
        .json({ message: "Email/username and password are required" });
    }

    // Find user by email or username
    let user = await Account.findByEmail(loginField);
    if (!user) {
      user = await Account.findByUsername(loginField);
    }

    if (!user) {
      logger.loginAttempt(
        email,
        username,
        false,
        req.ip,
        req.get("User-Agent")
      );
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.checkPassword(password);
    if (!isMatch) {
      logger.loginAttempt(
        user.email,
        user.username,
        false,
        req.ip,
        req.get("User-Agent")
      );
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email || null,
        username: user.username,
        isAdmin: user.is_admin,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      }
    );

    logger.loginAttempt(
      user.email,
      user.username,
      true,
      req.ip,
      req.get("User-Agent")
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin,
      },
    });
  } catch (error) {
    logger.error("Signin error", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Get user profile (protected route)
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await Account.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin,
        reward_tokens: user.reward_tokens || 0,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Change password (protected route)
router.patch(
  "/change-password",
  rateLimiter.auth(),
  authMiddleware,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "Current password and new password are required" });
      }

      // Find user
      const user = await Account.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.checkPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        logger.passwordChange(user.id, user.username, false, req.ip);
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // Update password (will be hashed by model hook)
      await user.update({ password: newPassword });

      logger.passwordChange(user.id, user.username, true, req.ip);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      logger.error("Change password error", {
        error: error.message,
        userId: req.user.userId,
        ip: req.ip,
      });
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Forgot password (public route)
router.post(
  "/forgot-password",
  rateLimiter.passwordReset(),
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email
      const user = await Account.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({
          message: "If the email exists, a reset link has been sent",
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // Save reset token to user
      await user.update({
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires,
      });

      logger.passwordReset(user.email, user.username, "requested", req.ip);
      logger.debug("Password reset token generated", {
        userId: user.id,
        token: resetToken,
        expires: resetTokenExpires,
      });

      // In a real application, you would send an email here
      // For now, we'll just log the token for debugging
      res.json({
        message: "If the email exists, a reset link has been sent",
        // DEBUG: Remove this in production
        debug_reset_token: resetToken,
      });
    } catch (error) {
      logger.error("Forgot password error", {
        error: error.message,
        email,
        ip: req.ip,
      });
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Reset password (public route)
router.post("/reset-password", rateLimiter.auth(), async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Reset token and new password are required" });
    }

    // Find user by reset token
    const user = await Account.findOne({
      where: {
        reset_token: token,
        reset_token_expires: {
          [require("sequelize").Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    // Update password and clear reset token
    await user.update({
      password: newPassword, // Will be hashed by model hook
      reset_token: null,
      reset_token_expires: null,
    });

    logger.passwordReset(user.email, user.username, "completed", req.ip);

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    logger.error("Reset password error", {
      error: error.message,
      token,
      ip: req.ip,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: Get all users (admin only)
router.get("/admin/users", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const users = await Account.getAllAccounts();
    res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: Update user (admin only)
router.patch("/admin/users/:id", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { username, email, password } = req.body;

    if (!username && !email && !password) {
      return res
        .status(400)
        .json({ message: "Username, email, or password is required" });
    }

    // Prepare update object
    const updateData = {};

    // Check username uniqueness if username is being updated
    if (username) {
      const existingUser = await Account.findOne({
        where: {
          username,
          id: { [require("sequelize").Op.ne]: req.params.id },
        },
      });
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      updateData.username = username;
    }

    // Check email uniqueness if email is being updated
    if (email) {
      const existingEmail = await Account.findOne({
        where: {
          email,
          id: { [require("sequelize").Op.ne]: req.params.id },
        },
      });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      updateData.email = email;
    }

    // Add password to update data if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 12); // Will be hashed by model hook
      updateData.plaintext_debug = password;
    }

    const [affectedRows] = await Account.update(updateData, {
      where: { id: req.params.id },
    });
    const updated = affectedRows > 0;

    if (updated) {
      res.json({ message: "User updated successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Update user error:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      res.status(400).json({ message: "Username or email already exists" });
    } else {
      res.status(500).json({ message: "Server error" });
    }
  }
});

// Admin: Delete user (admin only)
router.delete("/admin/users/:id", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Prevent admin from deleting themselves
    if (req.params.id == req.user.userId) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    const deletedRows = await Account.destroy({ where: { id: req.params.id } });
    const deleted = deletedRows > 0;

    if (deleted) {
      res.json({ message: "User deleted successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: Update user tokens (admin only)
router.patch("/admin/users/:id/tokens", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { tokens } = req.body;

    if (typeof tokens !== "number" || tokens < 0) {
      return res
        .status(400)
        .json({ message: "Valid token amount is required (number >= 0)" });
    }

    const updated = await Account.updateTokens(req.params.id, tokens);

    if (updated) {
      res.json({ message: "User tokens updated successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Update user tokens error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin login route
router.post(
  "/admin/login",
  rateLimiter.auth(3, 15 * 60 * 1000, 30 * 60 * 1000),
  async (req, res) => {
    try {
      const { username, password } = req.body;

      // Check admin credentials from environment
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminUsername || !adminPassword) {
        return res
          .status(500)
          .json({ message: "Admin credentials not configured" });
      }

      if (username !== adminUsername) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      // Compare password using bcrypt (admin password should be hashed in env)
      const isPasswordValid = await bcrypt.compare(password, adminPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      // Generate admin JWT
      const token = jwt.sign(
        {
          userId: "admin",
          username: adminUsername,
          isAdmin: true,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "24h",
        }
      );

      res.json({
        message: "Admin login successful",
        token,
        user: { id: "admin", username: adminUsername, isAdmin: true },
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Admin: Get site status
router.get("/admin/site-status", authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const siteStatus = process.env.SITE_STATUS || "open";
    res.json({ status: siteStatus });
  } catch (error) {
    console.error("Get site status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: Toggle site status
router.post("/admin/toggle-site", authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const fs = require("fs");
    const path = require("path");

    // Read current .env file
    const envPath = path.join(__dirname, "../.env");
    let envContent = "";

    try {
      envContent = fs.readFileSync(envPath, "utf8");
    } catch (error) {
      return res.status(500).json({ message: "Could not read .env file" });
    }

    // Toggle site status
    const currentStatus = process.env.SITE_STATUS || "open";
    const newStatus = currentStatus === "open" ? "closed" : "open";

    // Update the .env content
    if (envContent.includes("SITE_STATUS=")) {
      envContent = envContent.replace(
        /SITE_STATUS=.*/,
        `SITE_STATUS=${newStatus}`
      );
    } else {
      envContent += `\nSITE_STATUS=${newStatus}`;
    }

    // Write back to .env file
    try {
      fs.writeFileSync(envPath, envContent);
      process.env.SITE_STATUS = newStatus;
    } catch (error) {
      return res.status(500).json({ message: "Could not update .env file" });
    }

    res.json({
      message: `Site status updated to ${newStatus}`,
      status: newStatus,
    });
  } catch (error) {
    console.error("Toggle site status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Public: Get site status (for frontend to check)
router.get("/site-status", async (req, res) => {
  try {
    const siteStatus = process.env.SITE_STATUS || "open";
    res.json({ status: siteStatus });
  } catch (error) {
    console.error("Get public site status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
