'use strict';

import Core from '../tools/core.js';
import Dom from '../tools/dom.js';
import Templated from '../components/templated.js';

import DiagramAuto from './diagram/auto.js'
import GridAuto from './grid/auto.js'

export default Core.Templatable("Widget.MultiView", class MultiView extends Templated { 

	get Canvas() {
		return this.Widget("grid").Canvas;
	}

	set Size(value) {
		this.Elem("viz").style.width = value.width + "px";
		this.Elem("viz").style.height = value.height + "px";	
	}
	
	get Size() {
		return {
			width: this.Elem("viz").style.width,
			height: this.Elem("viz").style.height
		}
	}

	get AutoSize() {
		if (this.type == "DEVS") {
			return this.settings.DiagramSize(this.simulation);
		}
		else if (this.type == "Cell-DEVS") {
			var n = this.Widget("grid").layers.length;
			
			return this.settings.CanvasSize(this.simulation, n);
		}
	}

	set Settings(value) {
		this.settings = value;
		
		this.settings.On("Change", this.OnSettings_Change.bind(this));
	}
	
	set Simulation(value) {
		this.simulation = value;
	}

	constructor(node) {
		super(node);
		
		this.type = null;
		this.view = null;
	}
	
	Initialize(simulation, settings) {
		this.Simulation = simulation;
		this.Settings = settings;
	}
	
	OnSettings_Change(ev) {
		if (["height", "width", "columns", "spacing", "aspect"].indexOf(ev.property) == -1) return;
		
		this.Widget("grid").columns = this.settings.Get("grid", "columns");
		this.Widget("grid").spacing = this.settings.Get("grid", "spacing");
		
		this.Resize();
		this.Redraw();
	}
	
	Redraw() {
		this.view.Redraw();
	}
	
	Resize() {		
		this.Size = this.AutoSize;
	}
	
	Switch(type) {
		if (type == this.type) return;
		
		this.type = type;
		
		Dom.SetCss(this.Elem("viz"), `viz-container ${type}`);
		
		if (this.view) this.view.Destroy();
		
		if (type == "DEVS") {			
			var options = {
				clickEnabled:false
			}
			
			this.view = new DiagramAuto(this.Widget("diagram"), this.simulation, options);
		}
		else if (type === "Cell-DEVS") {
			var options = { 
				clickEnabled:false,
				columns:this.settings.Get("grid", "columns"), 
				spacing:this.settings.Get("grid", "spacing"), 
				layers:this.settings.Get("grid", "layers")
			}
			
			if (!options.layers) options.layers = this.simulation.LayersAndPorts();
			
			this.view = new GridAuto(this.Widget("grid"), this.simulation, options);
		}
		else {
			this.Elem("viz").style.width = null;
			this.Elem("viz").style.height = null;
			
			this.view = null;
		}
	}
	
	Template() {
		return "<div handle='viz' class='viz-container'>" +
				   "<div handle='diagram' widget='Widgets.Diagram' class='diagram-widget-container'></div>" +
				   "<div handle='grid' widget='Widgets.Grid' class='grid-widget-container'></div>" +
			   "</div>";
	}
});