const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hosts = JSON.parse(fs.readFileSync('hosts.json', 'utf8'));

const defaultBranch = 'main';

let nodlc = false;

function findDlc(dir) {
	if (nodlc) {
		return null;
	}

	const filepath = os.platform() === 'win32' ? path.join(dir, 'get_dlc_dangerously.bat') : path.join(dir, 'get_dlc_dangerously');
	if (fs.existsSync(filepath)) {
		return filepath;
	}
	else {
		return null;
	}
}

function findSubmodules(dir) {
	let repos = [];
	let repo = null;
	const filepath = path.join(dir, '.gitmodules');
	if (!fs.existsSync(filepath)) {
		return repos;
	}
	const lines = fs.readFileSync(filepath, 'utf8').split('\n');
	for (let line of lines) {
		if (line.startsWith('[')) {
			if (repo !== null) {
				repo.branch = repo.branch || defaultBranch;
				repos.push(repo);
			}
			repo = {};
		}
		else {
			if (line.indexOf('=') !== -1) {
				const parts = line.split('=');
				const name = parts[0].trim();
				const value = parts[1].trim();
				repo[name] = value;
			}
		}
	}
	if (repo !== null) {
		repo.branch = repo.branch || defaultBranch;
		repos.push(repo);
	}
	return repos;
}

function git(params, cwd = '.', check = true) {
	const status = child_process.spawnSync('git', params, {encoding: 'utf8', cwd: cwd}).status;
	if (status !== 0 && check) {
		let param = '';
		for (let p of params) {
			param += p + ' ';
		}
		console.log('git ' + param + 'exited with status ' + status + '.');
	}
	return status;
}

function git_clone(url, dir, branch = 'master', depth = 0) {
	if (depth) return git(['clone', url, dir, '-b', branch, '--depth', depth]);
	else return git(['clone', url, dir, '-b', branch]);
}

function git_exists(url) {
	return git(['ls-remote', '-h', url], '.', false) === 0;
}

function git_pull(dir, branch) {
	git(['pull', 'origin', branch], dir);
}

function findBestUrl(name, fallback) {
	for (let host of hosts) {
		const url = host.url.replace(/\?/g, name);
		if (git_exists(url)) return url;
	}
	return fallback;
}

function findName(url) {
	const parts = url.split('/');
	const last = parts[parts.length - 1];
	if (last.endsWith('.git')) {
		return last.substring(0, last.length - 4);
	}
	else {
		return last;
	}
}

function addRemotes(name, dir) {
	for (let host of hosts) {
		const url = host.url.replace(/\?/g, name);
		if (git_exists(url)) {
			git(['remote', 'add', host.name, url], dir);
		}
	}
}

function clone(name, dir, branch, fallback) {
	const url = findBestUrl(name, fallback);

	if (!url) {
		console.log('Could not find ' + name + '.');
		return;
	}

	console.log('Downloading ' + name + ' from ' + url + '.');
	let depth = 0;
	if (name.endsWith('_bin')) {
		depth = 3;
	}
	git_clone(url, dir, branch, depth);
	addRemotes(name, dir);

	const dlc = findDlc(dir);
	if (dlc) {
		const proc = child_process.spawnSync(dlc, [], {encoding: 'utf8', shell: true});
		if (proc.error) {
			console.log(proc.error);
		}
		else if (proc.status === null) {
			console.log('dlc download failed: ' + proc.signal);
		}
		else if (proc.status !== 0) {
			console.log('dlc download failed: ' + status);
		}
	}
	else {
		const repos = findSubmodules(dir);
		for (let repo of repos) {
			clone(findName(repo.url), path.join(dir, repo.path), repo.branch, repo.url);
		}
	}
}

function update(dir, branch) {
	console.log('Updating ' + dir + '.');
	git_pull(dir, branch);

	const dlc = findDlc(dir);
	if (dlc) {
		const proc = child_process.spawnSync(dlc, [], {encoding: 'utf8', shell: true});
		if (proc.error) {
			console.log(proc.error);
		}
		else if (proc.status === null) {
			console.log('dlc download failed: ' + proc.signal);
		}
		else if (proc.status !== 0) {
			console.log('dlc download failed: ' + status);
		}
	}
	else {
		const repos = findSubmodules(dir);
		for (let repo of repos) {
			update(path.join(dir, repo.path), repo.branch);
		}
	}
}

console.log('krab v1.1.2');

let name = null;
let branch = defaultBranch;

for (let i = 2; ; ++i) {
	if (!process.argv[i]) {
		break;
	}

	if (process.argv[i].substring(0, 2) === '--') {
		if (process.argv[i] === '--nodlc') {
			nodlc = true;
		}
	}
	else {
		if (!name) {
			name = process.argv[i];
		}
		else if (!branch) {
			branch = process.argv[i];
		}
	}
}

if (!name) {
	throw 'No name found';
}

name = name.trim();
while (name.startsWith('/') || name.startsWith('\\') || name.startsWith('.')) name = name.substring(1);
while (name.endsWith('/') || name.endsWith('\\')) name = name.substring(0, name.length - 1);

let dir = name;
if (branch !== defaultBranch) {
	dir = name + '-' + branch;
}

if (fs.existsSync(dir)) {
	update(dir, branch);
}
else {
	clone(name, dir, branch);
}
