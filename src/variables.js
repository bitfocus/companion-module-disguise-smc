exports.initVariables = function () {
	const variables = [
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

exports.updateVariables = function (data, path) {
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

		self.powerFault =
			data['Power Overload'] === true || data['Main Power Fault'] === true || data['Power Control Fault'] === true
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
			strip_red: data['ledR'],
			strip_green: data['ledG'],
			strip_blue: data['ledB'],
		})
	}
}
