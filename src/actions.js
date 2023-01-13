exports.initActions = function () {
	let self = this
	let actions = {}

	actions['power_on'] = {
		name: 'Power On',
		options: [],
		callback: (event) => {
			self.sendPostRequest('/api/chassis/power/on', {})
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
			self.sendPostRequest('/api/chassis/power/off', {})
		},
	}

	actions['power_cycle'] = {
		name: 'Power Cycle',
		options: [],
		callback: (event) => {
			self.sendPostRequest('/api/chassis/power/cycle', {})
		},
	}

	actions['who_am_i'] = {
		name: 'Flash LCD',
		options: [],
		callback: (event) => {
			self.sendPostRequest('/api/chassis/whoami', {})
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
			self.sendPostRequest('/api/oled/notification/time', timing)

			let object = {
				priority: opt.priority,
				title: opt.title,
				message: opt.message,
			}
			self.sendPostRequest('/api/oled/notification', object)
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
			self.sendPostRequest('/api/ledstrip', object)
		},
	}

	this.setActionDefinitions(actions)
}
