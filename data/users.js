// data/users.js
const users = [];

// Initialize with example user
users.push({ username: 'Example', password: 'example', email: 'Example' });

module.exports = {
  users,
  addUser: (user) => {
    users.push(user);
  },
  findUserByEmail: (email) => {
    return users.find((user) => user.email === email);
  },
  findUserById: (id) => {
    return users.find((user) => user.id === id);
  },
  getAllUsers: () => {
    return users;
  },
};
