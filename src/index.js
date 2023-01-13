const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const actions = require('./actions')
const feedbacks = require('./feedbacks')
const presets = require('./presets')
const variables = require('./variables')
const requests = require('./requests')

// Constants
const pollIntervalMs = 1000

class instance extends InstanceBase {
	constructor(internal) {
		super(internal)

		Object.assign(this, {
			...actions,
			...feedbacks,
			...presets,
			...variables,
			...requests,
		})

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
		this.stopPolling()
		this.debug('destroy', self.id)
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

	async poll() {
		const paths = ['/api/localmachine', '/api/chassis/power/status', '/api/vfcs', '/api/session', '/api/ledstrip']

		for (let path of paths) {
			await this.sendGetRequest(path)
				.then((response) => {
					this.updateVariables(response, path)
				})
				.catch(() => {
					if (!this.loggedError) {
						this.log('error', 'Get request failed.')
					}
				})
		}
	}
}

runEntrypoint(instance, [])
