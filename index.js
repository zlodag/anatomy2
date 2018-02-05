#!/usr/bin/env node

const args = require( 'argv' ).option([{
    name: 'region',
    short: 'r',
    type: 'csv,string',
    description: 'Search by region',
}, {
    name: 'category',
    short: 'c',
    type: 'csv,string',
    description: 'Search by category',
}, {
    name: 'section',
    short: 's',
    type: 'csv,string',
    description: 'Search by section',
}, {
    name: 'item',
    short: 'i',
    type: 'csv,string',
    description: 'Search by item',
}]).run();

const readline = require('readline');
const chalk = require('chalk');
const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const shuffle = require('shuffle-array');

const DETAIL_FIELDS = require('./detailFields.js');
const Region = require('./models/Region.js');
const Category = require('./models/Category.js');
const Section = require('./models/Section.js');
const Item = require('./models/Item.js');

let counter = 0;
let testItems;
let totalAnswers;
let remainder;
let newItem = true;

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
rl.on('SIGINT', quit);

mongoose.connect('mongodb://localhost/anatomy', {
	useMongoClient: true,
	autoIndex: false,
}).then(() => {
	if (args.options.region) {
		informSearching('regions', args.options.region);
		return Region.find({$text: {$search:args.options.region.join(' ')}}, {_id: 1, name: 1}).lean().exec().tap(informResults)
			.then(regions => Category.find({'region': {'$in': collateIds(regions)}}, {_id: 1}).lean().exec())
			.then(categories => Section.find({'category': {'$in': collateIds(categories)}}, {_id: 1}).lean().exec())
			.then(sections => Item.find({'section': {'$in': collateIds(sections)}}).exec());
	} else if (args.options.category){
		informSearching('categories', args.options.category);
		return Category.find({$text: {$search:args.options.category.join(' ')}}, {_id: 1, name: 1}).lean().exec().tap(informResults)
			.then(categories => Section.find({'category': {'$in': collateIds(categories)}}, {_id: 1}).lean().exec())
			.then(sections => Item.find({'section': {'$in': collateIds(sections)}}).exec());
	} else if (args.options.section){
		informSearching('sections', args.options.section);
		return Section.find({$text: {$search:args.options.section.join(' ')}}, {_id: 1, name: 1}).lean().exec().tap(informResults)
			.then(sections => Item.find({'section': {'$in': collateIds(sections)}}).exec());
	} else if (args.options.item){
		informSearching('items', args.options.item);
		return Item.find({$text: {$search:args.options.item.join(' ')}}).exec().tap(informResults);
	} else {
		console.log('Including', chalk.bold('all'), 'items');
		return Item.find().exec();
	}
}).then(items => {
	shuffle(items);
	testItems = items;
	if (preparePrompt()){
		rl.prompt();
		rl.on('line', line =>
			processAnswer(line.trim()) && preparePrompt() && rl.prompt()
		);
	}
}).catch(error => {
	console.error(chalk.red(error.message));
	process.exit();
});

function collateIds(documents){
	let ids = [];
	for (var i = 0; i < documents.length; i++) {
		ids.push(documents[i]._id);
	}
	return ids;
}

function preparePrompt() {
	if (!newItem && remainder == 0){
		counter++;
		newItem = true;
	}
	while (newItem) {
		if (!testItems || counter >= testItems.length){
			console.log('\nEnd of items');
			quit();
			return false;
		}
		const item = testItems[counter];
		console.log(chalk`\nItem ${counter + 1} of ${testItems.length}: {bold ${item.name}}`);
		totalAnswers = 0;
		for (var i = DETAIL_FIELDS.length - 1; i >= 0; i--) {
			const detailField = DETAIL_FIELDS[i];
			const itemField = item[detailField.key];
			totalAnswers += detailField.array ? itemField.length : !!itemField ? 1 : 0;
		}
		remainder = totalAnswers;
		if (remainder) {
			newItem = false;
		} else {
			informSkipping(item.name, true);
			counter++;
		}
	}
	rl.setPrompt(chalk.blue.bold(`\n${testItems[counter].name} >`));
	return true;
}

function processAnswer(answer) {
	if (answer == 'help') {
		printHelp();
	} else if (answer == 'quit') {
		quit();
		return false;
	} else if (answer == 'keys') {
		printKeys();
	} else if (answer == 'progress') {
		printProgress();
	} else if (answer.startsWith('cheat')) {
		const keys = answer.slice(5).match(/\S+/g);
		printAnswers(keys);
	} else if (answer == 'skip'){
		informSkipping(testItems[counter].name, false);
		counter++;
		newItem = true;
	} else {
	    let match = answer.match(/^(\w{2})\s+(.+)$/);
	    if (match) {
	    	const key = match[1].toLowerCase();
	    	for (var i = 0; i < DETAIL_FIELDS.length; i++) {
	    		const detailField = DETAIL_FIELDS[i];
	    		if (key == detailField.shortcut){
	    			const itemField = testItems[counter][detailField.key];
	    			if (detailField.array) {
						const tokens = match[2].split(',');
						for (var i = 0; i < tokens.length; i++) {
							const token = tokens[i].trim();
							if (isAdequateLength(token)){
								let found = false;
								for (var j = itemField.length - 1; !found && j >= 0; j--) {
									if (tokenMatches(token, detailField.label, itemField[j])){
										found = true;
										itemField.splice(j, 1);
										remainder--;
									}
								}
								if (!found) {
		    						informIncorrect(token, detailField.label);
								}
							}
						}
	    			} else {
	    				const token = match[2].trim();
	    				if (isAdequateLength(token)) {
		    				if (itemField && tokenMatches(token, detailField.label, itemField)){
		    					delete testItems[counter][detailField.key];
								remainder--;
		    				} else {
		    					informIncorrect(token, detailField.label);
							}
	    				}
	    			}
	    			return true;
	    		}
	    	}
	    	informInvalidKey(key);
	    } else {
		    console.log(chalk.magenta('Invalid input. Try', chalk.inverse('help')));
	    }
	}
	return true;
}

function printHelp() {
	console.log(chalk`
{bold.underline Usage}

{bold <key> <guess>[,<guess>...]}
	Attempt answer(s) to current item for the specified key
{bold progress}
	Show current item progress
{bold skip}
	Skip current item
{bold cheat}
	Print answer(s) to current item
{bold cheat <key> [<key>...]}
	Print answer(s) to current item for the specified key(s)
{bold keys}
	Display a list of keys
{bold help}
	Show this message
{bold quit}
	Quit
`);
}

function quit(){
	rl.close();
	console.log(chalk.gray('Goodbye'));
	process.exit();
}

function printKeys(){
	for (let i = 0; i < DETAIL_FIELDS.length; i++) {
		const detailField = DETAIL_FIELDS[i];
		console.log(chalk.underline(detailField.shortcut) + ' ' + chalk.blue(detailField.label));
	}
}

function printProgress(){
	console.log(chalk.yellow(`${totalAnswers-remainder} of ${totalAnswers}`));
}

function printAnswer(detailField, forcePrintEvenIfEmpty) {
	const itemField = testItems[counter][detailField.key];
	if (detailField.array ? itemField.length : itemField) {
		console.log(chalk.underline(detailField.label));
		if (detailField.array) {
			for (let j = 0; j < itemField.length; j++) {
				console.log('+ ' + itemField[j]);
			}
		} else {
			console.log('= ' + itemField);
		}
	} else if (forcePrintEvenIfEmpty) {
		console.log(chalk.gray.underline(detailField.label, '(N/A)'));
	}
}

function printAnswers(tokens) {
	if (tokens) {
		for (var i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			let found = false;
			for (var j = 0; !found && j < DETAIL_FIELDS.length; j++) {
				const detailField = DETAIL_FIELDS[j];
				if (token == detailField.shortcut) {
					found = true;
					printAnswer(detailField, true);
				}
			}
			if (!found) {
				informInvalidKey(token);
			}
		}
	} else {
		for (let i = 0; i < DETAIL_FIELDS.length; i++) {
			const detailField = DETAIL_FIELDS[i];
			printAnswer(detailField, false);
		}
	}
}

function tokenMatches(token, label, answer) {
	const indexStart = answer.toLowerCase().indexOf(token.toLowerCase());
	if (indexStart != -1) {
		informCorrect(answer, indexStart, indexStart + token.length, label);
		return true;
	}
	return false;
}

function isAdequateLength(token){
	if (token.length <= 2) {
		console.log(chalk.magenta('✘', chalk.bold('Entry must be 3 or more characters'),  chalk.inverse(token)));
		return false;
	}
	return true;
}

function informSearching(field, tokens){
	console.log('Searching for', chalk.bold(field), 'matching:', chalk.blue(tokens.join(chalk.black(' | '))));
}

function informResults(items){
	console.log('Matched:', chalk.bold(items.length));
	for (var i = 0; i < items.length; i++) {
		console.log('-', chalk.blue(items[i].name))
	}
}

function informSkipping(name, isEmpty){
	console.log('Skipping', chalk.bold.green(name), isEmpty ? '(empty)' : '');
}

function informCorrect(answer, indexStart, indexEnd, label){
	console.log(chalk.green('✔', chalk.underline(label), answer.slice(0, indexStart) + chalk.inverse(answer.slice(indexStart, indexEnd)) + answer.slice(indexEnd, answer.length)));
}

function informIncorrect(token, label) {
	console.log(chalk.red('✘', chalk.underline(label),  chalk.inverse(token)));
}

function informInvalidKey(token) {
	console.log(chalk.magenta(`Invalid key "${token}". Enter`, chalk.inverse('keys'), 'to list all valid keys'));
}