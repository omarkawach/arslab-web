'use strict';

import Core from '../../basic-tools/tools/core.js';
import Parser from "./parser.js";
import Transition from './json/transition.js';
import Simulation from './json/simulation.js';

import State from '../simulation/state.js';

export default class LopezCell extends Parser { 
	
	Parse(files) {
		var d = Core.Defer();

		var log = files.find(function(f) { return f.name.match(/.log/i); });

		if (!log) {
			d.Reject(new Error("A log (.log) file must be provided for the Lopez Cell-DEVS parser."));
		
			return d.promise;
		}
				
		var name = log.name.substr(0, log.name.length - 4);
		var simulation = new Simulation(name, "Lopez", "Cell-DEVS");

		var p = this.ReadByChunk(log, this.ParseLogChunk.bind(this));
			
		var defs = [p];
	
		Promise.all(defs).then((data) => {
			if (!data[0]) return d.Reject(new Error("Unable to parse the log (.log) file."));
			
			simulation.transitions = data[0];
			simulation.size = data[0].size; // TODO Where from?
			simulation.palette = null;
			
			var s = [0, 0, 0]
			
			// Get the largest size from the log file. This can still miss cells on the outer edges of the cell space if they have no transitions.
			for (var i = 0; i < simulation.transitions.length; i++) {
				var t = simulation.transitions[i];
				var c = t.id.split("-").map(c => +c);			// coordinates as array from id
				
				if (c[0] > s[0]) s[0] = c[0];
				if (c[1] > s[1]) s[1] = c[1];
				if (c[2] > s[2]) s[2] = c[2];
			}

			simulation.size = [s[0] + 1, s[1] + 1, s[2] + 1];
						
			d.Resolve(simulation);
		}, (error) => {
			d.Reject(error);
		});
		
		return d.promise;
	}
		
	ParseLogChunk(parsed, chunk, progress) {		
		var start = chunk.indexOf('0 / L / Y', 0);
							
		while (start > -1) {			
			var end = chunk.indexOf('\n', start);
			
			if (end == -1) end = chunk.length + 1;
			
			var length = end - start;
			var split = chunk.substr(start, length).split("/");
			
			// Parse coordinates, state value & frame timestamp
			var tmp = split[4].trim().split("(")
			
			// NOTE : Don't use regex, it's super slow.
			var t = split[3].trim();			// time
			var m = tmp[0];						// model name
			var c = tmp[1].slice(0, -1);		// id / coordinate
			var p = split[5].trim();			// port
			var v = parseFloat(split[6]);		// value
			
			var tmp = split.length == 8 ? split[7] : split[6]	// Weird case, there seems to be two formats, one of them as an extra / (see life 1 and life 2)
			
			var d = tmp.trim().split("(")[1].slice(0,-1)	// destination
			
			c = c.replace(/,/g, "-");
			
			parsed.push(new Transition("Y", t, m, c, p, v, d));
			
			var start = chunk.indexOf('0 / L / Y', start + length);
		};
				
		return parsed;
	}
}