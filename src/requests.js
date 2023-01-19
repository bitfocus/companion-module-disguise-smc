const request = require('request')
const { InstanceStatus } = require('@companion-module/base')

const timeoutMs = 2000

exports.checkIP = function (self, timestamp) {
	// Check if the IP was set.
	if (self.config.ip === undefined || self.config.ip.length === 0) {
		if (self.loggedError === false) {
			let msg = 'IP is not set'
			self.log('error', msg)
			self.updateStatus(InstanceStatus.BadConfig, msg)
			self.loggedError = true
		}

		self.timestampOfRequest = timestamp
		return false
	}
	return true
}

exports.sendGetRequest = function (patch) {
	let self = this

	return new Promise(function (resolve, reject) {
		const timestamp = Date.now()

		if (!self.checkIP(self, timestamp)) {
			return reject()
		}

		// Call the api endpoint to get the state.
		const options = {
			method: 'GET',
			url: 'http://' + self.config.ip + patch,
			timeout: timeoutMs,
			headers: {
				'Content-type': 'application/json',
				authorization: 'Basic ' + self.config.authorizationBasic,
			},
		}

		request(options, function (err, result) {
			const response = self.handleResponse(timestamp, err, result)
			if (response === undefined) {
				return reject()
			} else {
				return resolve(response)
			}
		})
	})
}

exports.sendPostRequest = function (patch, data) {
	let self = this
	const timestamp = Date.now()

	if (!this.checkIP(self, timestamp)) {
		return
	}

	let body = JSON.stringify(data)

	const options = {
		url: 'http://' + self.config.ip + patch,
		headers: {
			'Content-type': 'application/json',
			authorization: 'Basic ' + self.config.authorizationBasic,
		},
		body: body,
	}

	request.post(options, function (err, result, body) {
		const response = self.handleResponse(timestamp, err, result)
		self.updateVariables(response, patch)
	})
}

exports.sendPatchRequest = function (data) {
	let self = this
	const timestamp = Date.now()

	if (!this.checkIP(self, timestamp)) {
		return
	}

	let body = JSON.stringify(data)

	const options = {
		url: 'http://' + self.config.ip + '/api/v1/public',
		headers: {
			'Content-type': 'application/json',
			authorization: 'Basic ' + self.config.authorizationBasic,
		},
		body: body,
	}

	request.patch(options, function (err, result, body) {
		const response = self.handleResponse(timestamp, err, result)
		self.updateVariables(response, true)
	})
}

exports.handleResponse = function (timestamp, err, result) {
	const self = this

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
		} catch (error) {
			return
		}
	}
	return response
}
