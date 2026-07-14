let tasks;

export class SilentRenderer {
	static get tasks() {
		return tasks;
	}

	static get nonTTY() {
		return true;
	}

	static clearTasks() {
		tasks = [];
	}

	constructor(_tasks) {
		tasks = _tasks;
	}

	render() {}

	end() {}
}
