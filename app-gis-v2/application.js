'use strict';

import Core from '../api-web-devs/tools/core.js';
import Dom from '../api-web-devs/tools/dom.js';
import Net from '../api-web-devs/tools/net.js';
import Templated from '../api-web-devs/components/templated.js';
import Tooltip from '../api-web-devs/ui/tooltip.js';
import Configuration from '../api-web-devs/components/configuration/configuration.js';
import SimulationDEVS from '../api-web-devs/simulation/simulationDEVS.js';
import Playback from '../api-web-devs/widgets/playback.js';
import Recorder from '../api-web-devs/components/recorder.js';
import Parser from '../api-web-devs/components/parser.js';

import Map from './ol/map.js';
import Style from "./utils/style.js";
import Point from "./style/point.js";
import Polygon from "./style/polygon.js";

import Legend from "./ol/legend.js";

export default class Main extends Templated { 

	constructor(node, files, config, data) {		
		super(node);
		
		this.selected = null;
		this.files = files;
		this.config = config;
		this.data = data;
		
		// Load the simulation data
		var parser = new Parser();
		
		var p1 = parser.Parse(this.files).then(this.onSimulation_Loaded.bind(this), this.onApplication_Error.bind(this));
		
		var p2 = this.LoadMap();
		
		// Initialize simulation and simulation settings
		this.settings = Configuration.FromJson(config);
		
		Promise.all([p1, p2]).then(this.onApplication_Ready.bind(this));
	}
			
	onSimulation_Loaded(ev) {
		
		var pb = this.config.playback;
		
		// overwrite default settings if required
		if (pb) {
			if (pb.speed) this.settings.gis.Set("speed", +pb.speed);
			if (pb.loop) this.settings.gis.Set("loop", pb.loop);
			if (pb.cache) this.settings.gis.Set("cache", +pb.cache);
		}
		
		this.simulation = ev.simulation;
		
		var n = Math.ceil(this.simulation.Frames.length / this.settings.playback.cache);
		
		this.simulation.Initialize(n);
	}

	onApplication_Ready(ev) {		
		// Initialize simulation widgets
		var canvas = this.Elem("map").querySelector(".ol-layer").firstChild;
		
		this.Widget("playback").Initialize(this.simulation, this.settings);
		this.Widget("playback").Recorder = new Recorder(canvas);
		
		// Hook simulation events for the playback bar
		this.simulation.On("Jump", this.onSimulation_Jump.bind(this));
		this.simulation.On("Move", this.onSimulation_Move.bind(this));
		
		// Show geo layers and draw simulation state
		for (var id in this.map.Layers) this.map.Layers[id].set('visible', true);
		
		// Prepare simulation styles, set first one as currently selected, 
		// update the variable selector to reflect the current property being coloured
		this.styles = this.PrepareSimulationVisualization();
		this.current = this.styles[0];
		
		this.Draw(this.simulation.state.data);

		// Add map widgets, some of them require everything to be ready
		this.AddSelector();
		this.AddLegend();
		this.AddLayerSwitcher();
	}
	
	LoadMap() {	
		var d = Core.Defer();
	
		this.map = new Map(this.Elem("map"), [Map.BasemapOSM(true), Map.BasemapSatellite()]);
		
		if (this.config.gis.view) this.map.SetView(this.config.gis.view.center, this.config.gis.view.zoom);

		else this.map.SetView([-75.7, 45.3], 10);

		this.map.On("click", this.onMap_Click.bind(this));
		this.map.On("rendercomplete", (ev) => d.Resolve());
		
		// Add layers to the map according to the loaded geojson data
		var layers = this.data.map((d, i) => {	
			var config = this.config.gis.layers[i];	
			
			d.name = config.id;
			
			var layer = this.map.AddGeoJsonLayer(config.id, d);
			
			layer.set('visible', false);
						
			var style = Style.FromJson(config.type, config.style);
						
			layer.setStyle(style.Symbol());
		});
				
		return d.promise;
	}

	AddSelector() {
		var control = new ol.control.Control({
			element: this.Elem("variable-select-container")
		});
		
		this.config.gis.simulation.forEach((s, i) => {
			var option = Dom.Create("option", { "text":s.name, "value":i });
			
			this.Elem("variable-select").add(option);
		});
		
		this.Elem("variable-select").selectedIndex = 0;
		
		this.map.AddControl(control);

		this.Node("variable-select").On("change", this.onVariableSelect_Change.bind(this));
	}

	AddLegend(){	
		if (this.legend) this.map.RemoveControl(this.legend.OL);

		this.legend = new Legend(this.current.style);
		
		this.map.AddControl(this.legend.OL);
	}

	AddLayerSwitcher() {
		var ls = new ol.control.LayerSwitcher({ groupSelectStyle: "group" });
		
		this.map.AddControl(ls);
	}
	
	PrepareSimulationVisualization() {
		var stats = Style.Statistics(this.simulation);
		
		this.config.gis.simulation.forEach(s => {
			s.layer = this.config.gis.layers.find(l => l.id == s.layer);
			s.style = Style.FromJson(s.layer.type, s);

			s.style.Bucketize(stats);
		});
		
		return this.config.gis.simulation;
	}

	onVariableSelect_Change(ev){
		// Change to the style of the newly selected variable
		this.current = this.styles[ev.target.value];
		
		this.Draw(this.simulation.state.data);

		this.AddLegend(this.current.style.fill);
	}
	
	onSimulation_Jump(ev) {
		this.Draw(ev.state.data);
	}
	
	onSimulation_Move(ev) {
		var data = {};
		
		ev.frame.StateMessages.forEach(t => data[t.Emitter.Name] = t.Value);
		
		this.Draw(data);
	}
	
	Draw(data) {
		var layer = this.map.Layer(this.current.layer.id);
		var features = layer.getSource().getFeatures();
		
		features.forEach(f => {
			var id = f.getProperties()[this.current.layer.join];
			var d = data[id];
			
			if (!d) return;
			
			var symbol = this.current.style.Symbol(data[id]);

			f.setStyle(symbol);
		});
	}
	
	onApplication_Error(error) {
		alert(error.toString());
	}
	
	ResetSelected() {
		if (!this.selected) return;
		
		var id = this.selected.feature.getProperties()[this.current.layer.join];
		var emitter = this.simulation.Model(id);
		var data = this.simulation.state.GetValue(emitter);
		var style = this.current.style.Symbol(data);
		
		this.selected.feature.setStyle(style);
	}
	
	HighlightSelected() {		
		if (!this.selected) return;
		
		var json = this.config.gis.styles.find(s => s.id == "highlight");
		var style = Style.GetStyle("polygon", json);
		
		this.selected.feature.setStyle(style);
	}
	
	onMap_Click(ev) {
		this.ResetSelected();
						
		this.selected = ev.features.length > 0 ? ev.features[0] : null;
				
		if (this.selected) {
			this.HighlightSelected();
						
			var id = this.selected.feature.getProperties()[this.current.layer.join];
			var emitter = this.simulation.Model(id);
			var props = this.simulation.state.GetValue(emitter);
			
			var content = "<ul>";

			content += `<li>${this.current.layer.join}: ${id}</li>`
			
			for (var p in props) content += `<li>${p}: ${props[p]}</li>`
			
			content += "</ul>";
			
			this.map.ShowPopup(ev.coordinates, content);
		}
		
		else this.map.ShowPopup(null);
	}
	
	Template() {
		return	"<main handle='main'>" +
					"<div handle='map' class='map'></div>" +
					"<div handle='playback' widget='Widget.Playback'></div>" +					
						   
					"<div handle='variable-select-container' class='variable-select-container custom-control'>" + 
						"<label>nls(label_variable_select)</label>" +
						"<select handle='variable-select' title=nls(title_variable_select)></select></div>" +
					"</div>" +
				"</main>";
	}
}
