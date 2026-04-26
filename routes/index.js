const express = require("express");
const router = express.Router();
const jobRoutes = require("./jobRoutes");
const taskRoutes = require("./taskRoutes");

router.use("/jobs", jobRoutes);
router.use("/tasks", taskRoutes);
router.use("/auth", require("./authRoutes"));
router.use("/applications", require("./applications"));
router.use("/resume", require("./resume"));
router.use("/companies", require("./companies"));

module.exports = router;
