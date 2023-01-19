const { combineRgb } = require('@companion-module/base')

exports.initPresets = function () {
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
					state: 'true',
				},
				style: {
					color: combineRgb(0, 0, 0),
					bgcolor: combineRgb(255, 0, 0),
				},
			},
			{
				feedbackId: 'power',
				options: {
					state: 'on',
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
						actionId: 'power_off',
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'power_fault',
				options: {
					state: 'true',
				},
				style: {
					color: combineRgb(0, 0, 0),
					bgcolor: combineRgb(255, 0, 0),
				},
			},
			{
				feedbackId: 'power',
				options: {
					state: 'on',
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
