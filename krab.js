const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const hosts = JSON.parse(fs.readFileSync('hosts.json', 'utf8'));

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
	repos.push(repo);
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
	if (depth) return git(['clone', url, dir, '--depth', depth]);
	else return git(['clone', url, dir]);
}

function git_exists(url) {
	return git(['ls-remote', '-h', url], '.', false) === 0;
}

function git_checkout(branch, dir) {
	git(['checkout', branch], dir);
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

function clone(name, dir, branch = 'master', fallback) {
	const url = findBestUrl(name, fallback);

	console.log('Downloading ' + name + ' from ' + url + '.');
	let depth = 0;
	if (name.endsWith('_bin')) {
		depth = 3;
	}
	git_clone(url, dir, branch, depth);
	git_checkout(branch, dir);
	addRemotes(name, dir);

	const repos = findSubmodules(dir);
	for (let repo of repos) {
		clone(findName(repo.url), path.join(dir, repo.path), repo.branch, repo.url);
	}
}

function update(dir, branch = 'master') {
	console.log('Updating ' + dir + '.');
	git_pull(dir, branch);
	const repos = findSubmodules(dir);
	for (let repo of repos) {
		update(path.join(dir, repo.path), repo.branch);
	}
}

console.log('krab v1.0');

let name = process.argv[2];
name = name.trim();
if (name.startsWith('/')) name = name.substring(1);
if (name.endsWith('/')) name = name.substring(0, name.length - 1);

if (fs.existsSync(name)) {
	update(name);
}
else {
	clone(name, name);
}
