const { InstanceBase, Regex, runEntrypoint, combineRgb, InstanceStatus } = require('@companion-module/base')
const request = require('request')

// Constants
const pollIntervalMs = 1000
const timeoutMs = 2000

class instance extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.updateStatus(InstanceStatus.Disconnected)
	}

	async init(config, firstInit) {
		let self = this

		this.config = config

		// Variables
		self.timer = undefined
		self.loggedError = false // Stops the poll flooding the log
		self.firstAttempt = true
		self.timestampOfRequest = Date.now()

		self.createAuth()

		self.initActions()
		self.initFeedback()
		self.initPresets()
		self.initVariables()

		self.startPolling()
	}

	async destroy() {
		let self = this

		self.stopPolling()
		self.debug('destroy', self.id)
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Info',
				value: 'This module is for controlling the System Management Controller of Disguise Hardware.',
			},
			{
				type: 'static-text',
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
				regex: Regex.IP,
			},
			{
				type: 'static-text',
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

	async configUpdated(config) {
		this.config = config

		this.createAuth()
		this.startPolling()
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
			name: 'Power On',
			options: [],
			callback: (event) => {
				self.sendPost('/api/chassis/power/on', {})
			},
		}

		actions['power_off'] = {
			name: 'Power Off',
			options: [
				{
					type: 'text',
					label: 'Note: This will not gracefully shut down the OS',
				},
			],
			callback: (event) => {
				self.sendPost('/api/chassis/power/off', {})
			},
		}

		actions['power_cycle'] = {
			name: 'Power Cycle',
			options: [],
			callback: (event) => {
				self.sendPost('/api/chassis/power/cycle', {})
			},
		}

		actions['who_am_i'] = {
			name: 'Flash LCD',
			options: [],
			callback: (event) => {
				self.sendPost('/api/chassis/whoami', {})
			},
		}

		actions['notification'] = {
			name: 'Send a Notification to the LCD',
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
			callback: (event) => {
				let opt = event.options

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
			name: 'Set LED Strip',
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
			callback: (event) => {
				let opt = event.options
				let object = {
					ledMode: opt.mode,
					ledR: opt.red,
					ledG: opt.green,
					ledB: opt.blue,
				}
				self.sendPost('/api/ledstrip', object)
			},
		}

		this.setActionDefinitions(actions)
	}

	initFeedback() {
		let self = this
		let feedbacks = {}

		feedbacks['power'] = {
			type: 'boolean',
			name: 'Check System Power',
			description: 'Checks if the system is powered on (or off).',
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(0, 255, 0),
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
			name: 'Check Any Power Fault',
			description: 'Checks the machine for any power fault.',
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 0, 0),
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

		this.setFeedbackDefinitions(feedbacks)
	}

	initVariables() {
		let variables = [
			{
				name: 'Machine Serial',
				variableId: 'serial',
			},
			{
				name: 'Machine Name',
				variableId: 'hostname',
			},
			{
				name: 'Machine Type',
				variableId: 'type',
			},
			{
				name: 'Machine Role',
				variableId: 'role',
			},
			{
				name: 'System Power',
				variableId: 'system_power',
			},
			{
				name: 'Power Overload',
				variableId: 'power_overload',
			},
			{
				name: 'Main Power Fault',
				variableId: 'main_power_fault',
			},
			{
				name: 'Power Control Fault',
				variableId: 'power_control_fault',
			},
			{
				name: 'LED Strip Mode',
				variableId: 'strip_mode',
			},
			{
				name: 'LED Strip Red',
				variableId: 'strip_red',
			},
			{
				name: 'LED Strip Green',
				variableId: 'strip_green',
			},
			{
				name: 'LED Strip Blue',
				variableId: 'strip_blue',
			},
		]

		this.setVariableDefinitions(variables)
	}

	initPresets() {
		let presets = {}

		presets['power_on'] = {
			type: 'button',
			category: 'Power',
			name: 'Power On',
			style: {
				text: 'Power On',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'power_on',
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'power_fault',
					options: {
						id: 'on',
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(255, 0, 0),
					},
				},
				{
					feedbackId: 'power',
					options: {
						id: 'true',
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(0, 255, 0),
					},
				},
			],
		}

		presets['power_off'] = {
			type: 'button',
			category: 'Power',
			name: 'Power Off',
			style: {
				text: 'Power Off',
				size: '14',
				color: combineRgb(255, 0, 0),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'power_on',
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'power_fault',
					options: {
						id: 'on',
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(255, 0, 0),
					},
				},
				{
					feedbackId: 'power',
					options: {
						id: 'true',
					},
					style: {
						color: combineRgb(255, 0, 0),
						bgcolor: combineRgb(0, 255, 0),
					},
				},
			],
		}

		this.setPresetDefinitions(presets)
	}

	updateVariables(data, path) {
		let self = this

		if (data === undefined) {
			return
		}

		if (path === '/api/localmachine') {
			self.setVariableValues({ serial: data['serial'], hostname: data['hostname'], type: data['type'] })
		}

		if (path === '/api/chassis/power/status') {
			self.setVariableValues({
				system_power: data['System Power'],
				power_overload: data['Power Overload'],
				main_power_fault: data['Main Power Fault'],
				power_control_fault: data['Power Control Fault'],
			})
			self.power = data['System Power']
			self.checkFeedbacks('power')
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
			self.setVariableValues({ role: data['role'] })
		}

		if (path === '/api/ledstrip') {
			self.setVariableValues({
				strip_mode: data['ledMode'],
				strip_red: ['ledR'],
				strip_green: ['ledG'],
				strip_blue: ['ledB'],
			})
		}
	}

	startPolling = function () {
		this.log('debug', 'start polling')
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
				self.updateStatus(InstanceStatus.BadConfig, msg)
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
						self.updateStatus(InstanceStatus.ConnectionFailure, msg)
						self.loggedError = true
					}
					return
				}

				// Made a successful request.
				if (self.loggedError === true || self.firstAttempt) {
					self.log('info', 'HTTP connection succeeded')
					self.updateStatus(InstanceStatus.Ok)
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
					self.updateStatus(InstanceStatus.ConnectionFailure, msg)
					self.loggedError = true
				}
				return
			}

			// Made a successful request.
			if (self.loggedError === true || self.firstAttempt) {
				self.log('info', 'HTTP connection succeeded')
				self.updateStatus(InstanceStatus.Ok)
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

runEntrypoint(instance, [])
