const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");

// Standard RESTful routes mounted at '/api/tasks'
router.post('/', taskController.createTask)
router.get('/', taskController.getTasks)
router.get('/:id', taskController.getTaskById)
router.patch('/:id', taskController.updateTask)
router.delete('/:id', taskController.deleteTask)

module.exports = router;