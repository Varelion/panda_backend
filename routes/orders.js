const express = require('express');
const authMiddleware = require('../middleware/auth');
const Order = require('../models/Order');

const router = express.Router();

// Create a new order (protected route)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { total_amount, delivery_address, notes, special_instructions, items, character_name, delivery_location, coupon_used, tokens_used, secret_menu_tokens } = req.body;

    // Validate input
    if (!total_amount || !items || items.length === 0) {
      return res.status(400).json({ message: 'Total amount and items are required' });
    }

    // Handle token usage (both custom order and secret menu tokens)
    const totalTokensUsed = (tokens_used || 0) + (secret_menu_tokens || 0);
    
    if (totalTokensUsed > 0) {
      const Account = require('../models/User');
      const user = await Account.findById(req.user.userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (user.reward_tokens < totalTokensUsed) {
        return res.status(400).json({ 
          message: `Insufficient reward tokens. You need ${totalTokensUsed} tokens but only have ${user.reward_tokens}.` 
        });
      }
      
      // Subtract tokens from user account
      try {
        await Account.subtractTokens(req.user.userId, totalTokensUsed);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }

    // Create order
    const orderData = {
      user_id: req.user.userId,
      total_amount,
      delivery_address,
      notes,
      special_instructions,
      items,
      character_name,
      delivery_location: typeof delivery_location === 'object' ? JSON.stringify(delivery_location) : delivery_location,
      coupon_used,
      tokens_used: tokens_used || 0,
      secret_menu_tokens: secret_menu_tokens || 0
    };

    const order = await Order.createOrder(orderData);

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders for the authenticated user (protected route)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.findByUserId(req.user.userId);
    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific order by ID (protected route)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if the order belongs to the authenticated user
    if (order.account_id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update order status (protected route)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // First, get the order to check ownership
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if the order belongs to the authenticated user
    if (order.account_id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updated = await Order.updateStatus(req.params.id, status);
    
    if (updated) {
      res.json({ message: 'Order status updated successfully' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an order (protected route)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // First, get the order to check ownership
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if the order belongs to the authenticated user
    if (order.account_id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const deleted = await Order.delete(req.params.id);
    
    if (deleted) {
      res.json({ message: 'Order deleted successfully' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all orders (admin only)
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orders = await Order.getAllOrders();
    res.json({ orders });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update order delivered status (admin only)
router.patch('/:id/delivered', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { delivered } = req.body;

    if (typeof delivered !== 'boolean') {
      return res.status(400).json({ message: 'Delivered status must be a boolean' });
    }

    const updated = await Order.updateDelivered(req.params.id, delivered);
    
    if (updated) {
      res.json({ message: 'Order delivery status updated successfully' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    console.error('Update order delivered status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update order status (admin only)
router.patch('/admin/:id/status', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await Order.updateStatus(req.params.id, status);
    
    if (updated) {
      res.json({ message: 'Order status updated successfully' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    console.error('Admin update order status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Mark order as complete and award tokens (admin only)
router.patch('/admin/:id/complete', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { tokens_to_award } = req.body;

    if (typeof tokens_to_award !== 'number' || tokens_to_award < 0) {
      return res.status(400).json({ message: 'Valid tokens_to_award is required (number >= 0)' });
    }

    const result = await Order.markCompleteAndAwardTokens(req.params.id, tokens_to_award);
    
    res.json({ 
      message: 'Order marked as complete and tokens awarded successfully',
      result
    });
  } catch (error) {
    console.error('Admin complete order error:', error);
    if (error.message === 'Order not found' || error.message === 'Order already completed') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Get user token balance (protected route)
router.get('/user/tokens', authMiddleware, async (req, res) => {
  try {
    const Account = require('../models/User');
    const user = await Account.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      reward_tokens: user.reward_tokens || 0 
    });
  } catch (error) {
    console.error('Get user tokens error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;