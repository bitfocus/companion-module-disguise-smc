const { combineRgb } = require('@companion-module/base')

exports.initFeedback = function () {
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
			return self.power === feedback.options.state
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
			return self.powerFault === (feedback.options.state === 'true')
		},
	}

	this.setFeedbackDefinitions(feedbacks)
}
