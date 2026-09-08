const express = require('express')
const route = express.Router()
const testController = require('../controllers/test.controller')

route.get('/test/getAll', testController.getAllTests)

module.exports = route
