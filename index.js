const instance_skel = require('../../instance_skel')
const request = require('request')

// Constants
const pollIntervalMs = 1000
const timeoutMs = 2000

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config)
		let self = this

		// Variables
		self.timer = undefined
		self.loggedError = false // Stops the poll flooding the log
		self.firstAttempt = true
		self.timestampOfRequest = Date.now()

		self.initActions()
		self.initFeedback()
		self.initPresets()

		self.status(self.STATUS_UNKNOWN, '')
	}

	config_fields() {
		let self = this

		return [
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Info',
				value: 'This module is for controlling the System Management Controller of Disguise Hardware.',
			},
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Firmware',
				value: 'Latest supported firmware version: 4.3.7',
			},
			{
				type: 'textinput',
				id: 'ip',
				label: 'Target IP',
				width: 12,
				regex: self.REGEX_IP,
			},
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Authentication',
				value: 'A username and password is only needed for sending commands to the SMC.',
			},
			{
				type: 'textinput',
				id: 'username',
				label: 'Username',
				width: 6,
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 6,
			},
		]
	}

	init() {
		let self = this

		self.createAuth()

		self.initVariables()
		self.startPolling()
	}

	destroy() {
		let self = this

		self.stopPolling()
		self.debug('destroy', self.id)
	}

	createAuth() {
		let self = this

		let data = self.config.username + ':' + self.config.password
		let buff = Buffer.from(data)
		self.config.authorizationBasic = buff.toString('base64')
	}

	initActions() {
		let self = this
		let actions = {}

		actions['power_on'] = {
			label: 'Power On',
			callback: (action, bank) => {
				self.sendPost('/api/chassis/power/on', {})
			},
		}

		actions['power_off'] = {
			label: 'Power Off',
			options: [
				{
					type: 'text',
					label: 'Note: This will not gracefully shut down the OS',
				},
			],
			callback: (action, bank) => {
				self.sendPost('/api/chassis/power/off', {})
			},
		}

		actions['power_cycle'] = {
			label: 'Power Cycle',
			callback: (action, bank) => {
				self.sendPost('/api/chassis/power/cycle', {})
			},
		}

		actions['who_am_i'] = {
			label: 'Flash LCD',
			callback: (action, bank) => {
				self.sendPost('/api/chassis/whoami', {})
			},
		}

		actions['notification'] = {
			label: 'Send a Notification to the LCD',
			options: [
				{
					type: 'textinput',
					label: 'Title',
					id: 'title',
					default: '',
				},
				{
					type: 'textinput',
					label: 'Message',
					id: 'message',
					default: '',
				},
				{
					type: 'number',
					label: 'Priority',
					id: 'priority',
					min: 0,
					max: 2,
					default: 0,
					step: 1,
					required: true,
				},
				{
					type: 'number',
					label: 'Duration',
					id: 'duration',
					min: 5,
					max: 30,
					default: 10,
					step: 1,
					required: true,
				},
			],
			callback: (action, bank) => {
				let opt = action.options

				let timing = {
					time: opt.duration,
				}
				self.sendPost('/api/oled/notification/time', timing)

				let object = {
					priority: opt.priority,
					title: opt.title,
					message: opt.message,
				}
				self.sendPost('/api/oled/notification', object)
			},
		}

		actions['set_strip'] = {
			label: 'Set LED Strip',
			options: [
				{
					type: 'dropdown',
					label: 'Select Mode',
					id: 'mode',
					default: 'static',
					choices: [
						{ id: 'static', label: 'Static' },
						{ id: 'colour_id', label: 'Colour ID' },
						{ id: 'rainbow', label: 'Rainbow' },
					],
				},
				{
					type: 'number',
					label: 'Red',
					id: 'red',
					min: 0,
					max: 255,
					default: 0,
					step: 1,
					required: false,
				},
				{
					type: 'number',
					label: 'Green',
					id: 'green',
					min: 0,
					max: 255,
					default: 0,
					step: 1,
					required: false,
				},
				{
					type: 'number',
					label: 'Blue',
					id: 'blue',
					min: 0,
					max: 255,
					default: 0,
					step: 1,
					required: false,
				},
			],
			callback: (action, bank) => {
				let opt = action.options
				let object = {
					ledMode: opt.mode,
					ledR: opt.red,
					ledG: opt.green,
					ledB: opt.blue,
				}
				self.sendPost('/api/ledstrip', object)
			},
		}

		self.setActions(actions)
	}

	initFeedback() {
		let self = this
		let feedbacks = {}

		feedbacks['power'] = {
			type: 'boolean',
			label: 'Check System Power',
			description: 'Checks if the system is powered on (or off).',
			style: {
				color: self.rgb(0, 0, 0),
				bgcolor: self.rgb(0, 255, 0),
			},
			options: [
				{
					type: 'dropdown',
					label: 'State',
					id: 'state',
					default: 'on',
					choices: [
						{ id: 'on', label: 'On' },
						{ id: 'off', label: 'Off' },
					],
				},
			],
			callback: function (feedback) {
				if (self.power === feedback.options.state) {
					return true
				} else {
					return false
				}
			},
		}

		feedbacks['power_fault'] = {
			type: 'boolean',
			label: 'Check Any Power Fault',
			description: 'Checks the machine for any power fault.',
			style: {
				color: self.rgb(0, 0, 0),
				bgcolor: self.rgb(255, 0, 0),
			},
			options: [
				{
					type: 'dropdown',
					label: 'State',
					id: 'state',
					default: 'true',
					choices: [
						{ id: 'true', label: 'True' },
						{ id: 'false', label: 'False' },
					],
				},
			],
			callback: function (feedback) {
				if (self.powerFault === (feedback.options.state === 'true')) {
					return true
				} else {
					return false
				}
			},
		}

		self.setFeedbackDefinitions(feedbacks)
	}

	initVariables() {
		let self = this

		let variables = [
			{
				label: 'Machine Serial',
				name: 'serial',
			},
			{
				label: 'Machine Name',
				name: 'hostname',
			},
			{
				label: 'Machine Type',
				name: 'type',
			},
			{
				label: 'Machine Role',
				name: 'role',
			},
			{
				label: 'System Power',
				name: 'system_power',
			},
			{
				label: 'Power Overload',
				name: 'power_overload',
			},
			{
				label: 'Main Power Fault',
				name: 'main_power_fault',
			},
			{
				label: 'Power Control Fault',
				name: 'power_control_fault',
			},
			{
				label: 'LED Strip Mode',
				name: 'strip_mode',
			},
			{
				label: 'LED Strip Red',
				name: 'strip_red',
			},
			{
				label: 'LED Strip Green',
				name: 'strip_green',
			},
			{
				label: 'LED Strip Blue',
				name: 'strip_blue',
			},
		]

		self.setVariableDefinitions(variables)
	}

	initPresets() {
		let self = this
		let presets = []

		presets.push({
			category: 'Power',
			label: 'Power On',
			bank: {
				style: 'text',
				text: 'Power On',
				size: '14',
				color: self.rgb(255, 255, 255),
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'power_on',
				},
			],
			feedbacks: [
				{
					type: 'power_fault',
					options: {
						id: 'on',
					},
					style: {
						color: self.rgb(0, 0, 0),
						bgcolor: self.rgb(255, 0, 0),
					},
				},
				{
					type: 'power',
					options: {
						id: 'true',
					},
					style: {
						color: self.rgb(0, 0, 0),
						bgcolor: self.rgb(0, 255, 0),
					},
				},
			],
		})

		presets.push({
			category: 'Power',
			label: 'Power Off',
			bank: {
				style: 'text',
				text: 'Power Off',
				size: '14',
				color: self.rgb(255, 0, 0),
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'power_on',
				},
			],
			feedbacks: [
				{
					type: 'power_fault',
					options: {
						id: 'on',
					},
					style: {
						color: self.rgb(0, 0, 0),
						bgcolor: self.rgb(255, 0, 0),
					},
				},
				{
					type: 'power',
					options: {
						id: 'true',
					},
					style: {
						color: self.rgb(255, 0, 0),
						bgcolor: self.rgb(0, 255, 0),
					},
				},
			],
		})

		self.setPresetDefinitions(presets)
	}

	updateConfig(config) {
		let self = this

		self.config = config

		self.createAuth()
		self.startPolling()
	}

	updateVariables(data, path) {
		let self = this

		if (data === undefined) {
			return
		}

		if (path === '/api/localmachine') {
			self.setVariable('serial', data['serial'])
			self.setVariable('hostname', data['hostname'])
			self.setVariable('type', data['type'])
		}

		if (path === '/api/chassis/power/status') {
			self.setVariable('system_power', data['System Power'])
			self.power = data['System Power']
			self.checkFeedbacks('power')
			self.setVariable('power_overload', data['Power Overload'])
			self.setVariable('main_power_fault', data['Main Power Fault'])
			self.setVariable('power_control_fault', data['Power Control Fault'])
			self.powerFault = false
			if (
				data['Power Overload'] === true ||
				data['Main Power Fault'] === true ||
				data['Power Control Fault'] === true
			) {
				self.powerFault = true
			}
			self.checkFeedbacks('power_fault')
		}

		if (path === '/api/vfcs') {
		}

		if (path === '/api/session') {
			self.setVariable('role', data['role'])
		}

		if (path === '/api/ledstrip') {
			self.setVariable('strip_mode', data['ledMode'])
			self.setVariable('strip_red', data['ledR'])
			self.setVariable('strip_green', data['ledG'])
			self.setVariable('strip_blue', data['ledB'])
		}
	}

	startPolling = function () {
		let self = this

		if (self.timer === undefined) {
			self.timer = setInterval(self.poll.bind(self), pollIntervalMs)
		}

		self.poll()
	}

	stopPolling() {
		let self = this

		if (self.timer !== undefined) {
			clearInterval(self.timer)
			delete self.timer
		}
	}

	poll() {
		let self = this

		const paths = ['/api/localmachine', '/api/chassis/power/status', '/api/vfcs', '/api/session', '/api/ledstrip']
		const timestamp = Date.now()

		// Check if the IP was set.
		if (self.config.ip === undefined || self.config.ip.length === 0) {
			if (self.loggedError === false) {
				let msg = 'IP is not set'
				self.log('error', msg)
				self.status(self.STATUS_WARNING, msg)
				self.loggedError = true
			}

			self.timestampOfRequest = timestamp
			return
		}

		for (let path of paths) {
			// Call the api endpoint to get the state.
			const options = {
				method: 'GET',
				url: 'http://' + self.config.ip + path,
				timeout: timeoutMs,
				headers: {
					'Content-type': 'application/json',
				},
			}

			request(options, function (err, result) {
				// If the request is old it should be ignored.
				if (timestamp < self.timestampOfRequest) {
					return
				}

				self.timestampOfRequest = timestamp

				// Check if request was unsuccessful.
				if (err !== null || result.statusCode !== 200) {
					if (self.loggedError === false) {
						let msg = 'HTTP GET Request for ' + self.config.ip + ' failed'
						if (err !== null) {
							msg += ' (' + err + ')'
						} else {
							msg += ' (' + result.statusCode + ': ' + result.body + ')'
						}

						self.log('error', msg)
						self.status(self.STATUS_ERROR, msg)
						self.loggedError = true
					}
					return
				}

				// Made a successful request.
				if (self.loggedError === true || self.firstAttempt) {
					self.log('info', 'HTTP connection succeeded')
					self.status(self.STATUS_OK)
					self.loggedError = false
					self.firstAttempt = false
				}

				let response = {}
				if (result.body.length > 0) {
					try {
						response = JSON.parse(result.body.toString())
					} catch (error) {}
				}

				self.updateVariables(response, path)
			})
		}
	}

	sendPost(path, data) {
		let self = this
		const timestamp = Date.now()

		let body = JSON.stringify(data)

		const options = {
			url: 'http://' + self.config.ip + path,
			headers: {
				'Content-type': 'application/json',
				authorization: 'Basic ' + self.config.authorizationBasic,
			},
			body: body,
		}

		request.post(options, function (err, result, body) {
			// If the request is old it should be ignored.
			if (timestamp < self.timestampOfRequest) {
				return
			}

			self.timestampOfRequest = timestamp

			// Check if request was unsuccessful.
			if (err !== null || result.statusCode !== 200) {
				if (self.loggedError === false) {
					let msg = 'HTTP GET Request for ' + self.config.ip + ' failed'
					if (err !== null) {
						msg += ' (' + err + ')'
					} else {
						msg += ' (' + result.statusCode + ': ' + result.body + ')'
					}

					self.log('error', msg)
					self.status(self.STATUS_ERROR, msg)
					self.loggedError = true
				}
				return
			}

			// Made a successful request.
			if (self.loggedError === true || self.firstAttempt) {
				self.log('info', 'HTTP connection succeeded')
				self.status(self.STATUS_OK)
				self.loggedError = false
				self.firstAttempt = false
			}

			let response = {}
			if (result.body.length > 0) {
				try {
					response = JSON.parse(result.body.toString())
				} catch (error) {}
			}
			self.updateVariables(response, path)
		})
	}
}

exports = module.exports = instance
