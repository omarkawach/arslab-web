"use strict";

import Core from "../api-web-devs/tools/core.js";
import Dom from "../api-web-devs/tools/dom.js";
import Net from "../api-web-devs/tools/net.js";
import Templated from "../api-web-devs/components/templated.js";
import Playback from "../api-web-devs/widgets/playback.js";
import Map from "./widgets/map.js";
import Box from "../api-web-devs/ui/box-input-files.js";
import VectorLayer from "./classes/vectorLayer.js";
import GetScale from "./classes/getScale.js";
import SimulationDEVS from "../api-web-devs/simulation/simulationDEVS.js";
import Model from "../api-web-devs/simulation/model.js";
import FrameDEVS from "../api-web-devs/simulation/frameDEVS.js";
import TransitionDEVS from "../api-web-devs/simulation/transitionDEVS.js";
import CustomParser from "./parsers/customParser.js";
import CreateCsvFileForDownload from "./classes/CreateCsvFile.js";

import { mapOnClick } from "./widgets/mapOnClick.js";
import { createTransitionFromSimulation } from "../app-gis/functions/simToTransition.js";
import { sortPandemicData } from "../app-gis/functions/sortPandemicData.js";

export default class Application extends Templated {
  constructor(node) {
    super(node);

    // By default the legend will be red-white unless otherwise specified by the user
    this.CreateLegend(Core.Nls("App_Legend_Title"), "translate(10,10)");

    // The world map will appear prior to any vector layers being added overtop
    this.Widget("map").InitTileLayer();

    // Usining simulation results and a chosen geojson layer, we create a vector layer 
    this.Node('simResults').On("change", this.ChunkSimulationResults.bind(this))
    
    // Change which simulation you wish to manipulate 
    this.Node('selectSimulation').On("change", this.OnSimulationSelectChange.bind(this))

    // Modifies an existing vector layer depending on the simulation cycle selector's current value
    this.Node("cycle").On("change", this.OnCycle_Change.bind(this));

    // For downloading data as CSV after all necessary files are inserted by user
    this.Node("btnDownload").On("click", this.OnButtonDownload_Click.bind(this));

    // Fill sidebar with HTML
    this.AddToSideBar()
  }

  AddToSideBar(){
    var foo = document.getElementById("userData")
    foo.appendChild(document.getElementById("userdata"))
    var bar = document.getElementById("manipulate")
    bar.appendChild(document.getElementById("navigation"))
    var spam = document.getElementById("downloadCSV")
    spam.appendChild(document.getElementById("download"))
  }

  /*
  Purpose: Information we may find useful to access throughout the program

  @Method: ArrayOfTransitions(data, title)
    - From simulation object, we store created transitions in this method via array
    - Used for letting users download a CSV of the currently selected simulation
  @Method: KeepTrackOfSubmittedUserFiles(data, title, layerFile)
    - When a user finishes inserted their files, we get an array composed of an object holding:
      - Simulation title
      - Simulation data
      - GeoJSON layer file content
    - The array length increases as the user adds more simulations to the webpage
  */
  ArrayOfTransitions(data, title){
    if(this.allTransitions == undefined){ this.allTransitions = new Array; }
    this.allTransitions.push({simulation: title, transitionData: data});
  }

  CurrentColorScale(scale) { this.currentColorScale = scale; }

  KeepTrackOfSubmittedUserFiles(data, title, layerFile, classNum, color, cycle){
    if(this.DataFromFiles == undefined){ this.DataFromFiles = new Array; }
    this.DataFromFiles.push({
        simulation: title, 
        simulationData: data, 
        GeoJSON: layerFile, 
        layerClasses: classNum, 
        layerColor: color, 
        layerCycle: cycle});
  }

  /*
  Purpose: 
    - Browsers have limitations. Google Chrome only supports 500mb blobs. 
    - As a work around to this limitation, the upload simulation result file is uploaded to the app in chunks.
    - Once the text file has been safely chunked, we call DataLoaded_Handler(data) to now sort the text file accordingly 
  Paramter:
    event - The event being that the user just submitted a file
  */
  ChunkSimulationResults(event) {
    this.Elem("wait").hidden = false;

    let self = this,
      file = event.target.files[0], parser = new CustomParser()

    parser.Parse(file).then(function (data) { 
      self.Elem("wait").hidden = true;
      self.DataLoaded_Handler(data); 
    })
  }

  /*
  Purpose: 
    - After Safely chunking simulation results, we can now sort the data. 
    - After sorting data, the user can now upload their GeoJSON layer file.
  Paramter:
    data - holds everything from the simulation results text file
  Information leaving the method:
    - this.data for CheckForGeoJSON(input)
  */
  DataLoaded_Handler(data) {
    
    this.data = sortPandemicData(data);
    // User can now insert a GeoJSON layer file
    this.Elem("vectorLayer").disabled = false;
    this.Elem("downlaodbtnTwo").disabled = false;
    this.CheckForGeoJSON(document.querySelector("input[name='vectorLayer']"));
  }

  /*
  Purpose: Once a user enters a GeoJSON layer file, we go through the following process:
    - Read content of the GeoJSON layer file
    - Read the title of the GeoJSON layer file
    - Count how many simulations we've done so far
    - Update the simulation selector on the webpage
    - Update the Simulation cycle selector max number of cycles on the webpage
    - Update the current simulation on webpage
    - Display the vector layer onto the map in the webpage
    - Erase chosen files from the web page so that the user can now sequentially insert new files again
  Paramters:
    - input (a .geojson file)
  Information leaving the method:
    - KeepTrackOfSubmittedUserFiles(data, title, layerFile)
    - CurrentSimulationTitle(title)
    - CurrentSimulationGeoJSON(layerFileTitle);
  */
  CheckForGeoJSON(input) {
    let self = this;
    input.addEventListener("change", function (event) {
      self.Elem("wait").hidden = false;
      let f = event.target.files[0], 
        fileReader = new FileReader();

      fileReader.onload = function (event) {
        let fileContent = event.target.result, 
          title = f.name.substring(0, f.name.indexOf("."));
        
        let simNum = (self.DataFromFiles == undefined) ? 0 : self.DataFromFiles.length;
        let newTitle = "simulation" + simNum + "_" + title;

        self.SimulationSelectors(newTitle, self.data.length)
        
        // Get current number of classes for scale
        let classes = (self.currentClass == undefined) ? 4 : self.currentClass;

        // Information leaving the method
        self.KeepTrackOfSubmittedUserFiles(self.data, newTitle, fileContent, classes, self.currentColor, 0)
        self.currentSimulationTitle = newTitle
        self.currentSimulationLayerGeoJSON = fileContent;

        // Display the vector layer onto map
        let scale = (self.currentColorScale == undefined) ? self.CurrentColorScale(new GetScale(self.currentColor, classes)) : self.currentColorScale;
        self.LayerOntoMap(fileContent, newTitle, self.data[0].messages, scale.GS, true, true);
      };
      if(f != undefined){ fileReader.readAsDataURL(f); }

      // Dont need files anymore
      document.querySelector('input[name="simResults"]').value= null;
      document.querySelector("input[name='vectorLayer']").value = null;
      self.Elem("vectorLayer").disabled = true;
      self.Elem("downlaodbtnTwo").disabled = true;
    }, false);
  }

  SimulationSelectors(title, length){
    // For manipulate data simulation selector 
    var elem = document.createElement('option')
    var elemText = document.createTextNode(title + " with " + length + " cycles")
    elem.appendChild(elemText)
    var foo = document.getElementById("sim-select")
    foo.appendChild(elem)
    // Change to the most recent option
    foo.selectedIndex = foo.options.length-1

    // For download data simulation selector
    // The next 3 lines are needed, dont remove it. 
    elem = document.createElement('option')
    elemText = document.createTextNode(title + " with " + length + " cycles")
    elem.appendChild(elemText)
    var bar = document.getElementById("sim-download")
    bar.appendChild(elem)
    bar.selectedIndex = bar.options.length-1

    // For simulaton cycle selector 
    this.Elem("cycle").setAttribute("max", length - 1);
    this.Elem("output").textContent = 0;
    document.getElementById("cycle").value = 0
  }

  /* 
  Purpose: 
    - Create the vector layer by: 
      - Reading layer coordinates 
      - Adding a title 
      - Matching simulation data to census subdivisions
      - Coloring in each census subdivision based on its infeced proportion value
    - Create simulaton object if we are entering from CheckForGeoJSON(input)
    - Click and see vector layer data of current simulation
  Parameters:
    fileContent - Content from GeoJSON layer file
    title - Title from GeoJSON layer file
    data - data from simulation results
    scale - color scale based on whats selected by the user on the webpage (or default red)
    CreateSimulationObject - a boolean to tell us whether to make a smulation object (only true in CheckForGeoJSON(input))
  */
  LayerOntoMap(fileContent, title, data, scale, CreateSimulationObject, wait) {
    if (wait) this.Elem("wait").hidden = true;

    let layer;
    let cycle;

    //Title the vector layer based on what cycle it is on, might not be necessary, but keep it this code for now
    let newTitle;
    if (this.currentSimulationCycle == undefined || CreateSimulationObject == true) { 
      newTitle = title + " Cycle0"
      cycle = 0;
      layer = new VectorLayer(fileContent, newTitle, data, scale); 
    }
    else { 
      newTitle = title + " Cycle" + this.currentSimulationCycle;
      cycle = this.currentSimulationCycle
      layer = new VectorLayer(fileContent, newTitle, data, scale); 
    }

    // add vector layer onto world map
    this.Widget("map").AddLayer(title, layer);

    // make the vector layers attributes visible through clicking census subdivisions
    mapOnClick(data, this.Widget("map").map._map, newTitle, title, cycle);

    // Creates the simulaiton object only once state.txt and geojson are loaded. This step does not occur twice.
    if (CreateSimulationObject == true) { layer.OL.getSource().once("change", this.OnLayerCreation_Handler.bind(this)); }
  }


  /*
  Purpose: 
    - Create the initial legend (red) whent the webpage loads
    - Recreate the the legend on the webpage based on user selection
      - Also recolors the current simulation vector layer (if there is a current one)
  Paramters:
    title - Name of the legend 
    translate - Where on the webpage the legend will appear
  */
  CreateLegend(title, translate) {
    this.InitialLegend(title, translate);
    this.RecreateLegendColor(title, translate);
    this.RecreateLegendClass(title, translate);
  }

  InitialLegend(title, translate) {
    // Get current number of classes for scale
    let classes = (this.currentNumberOfClasses == undefined) ? 4 : this.currentNumberOfClasses;

    this.currentColor = "#FF0000";
    this.currentColorScale = new GetScale(this.currentColor, classes);
    let scale = this.currentColorScale;
    this.LegendToApp(title, translate, scale)
  }

  LegendToApp(title, translate, scale){
    const svg = d3.select("svg");

    svg.selectAll("*").remove();

    svg.append("g").attr("class", title).attr("transform", translate);

    var colorLegend = d3
      .legendColor()
      .labelFormat(d3.format(".2f"))
      // To actually color the legend based on our chosen colors
      .scale(scale.GS);

    svg.select("." + title).call(colorLegend);
  }

  RecreateLegendColor(title, translate) {
    let self = this;
    let scale;
    
    // Recreate the legend if a color change is issued
    d3.select("#colorOne").on("change", function () {
      var val = d3.select(this).node().value;
      self.currentColor = val;

      if(self.DataFromFiles != undefined){
        var currentDataFileIndex = document.getElementById('sim-select').selectedIndex;
        self.DataFromFiles[currentDataFileIndex].layerColor = val;
      }   
      
      // Get current number of classes for scale
      let classes = (self.currentClass == undefined) ? 4 : self.currentClass;

      self.currentColorScale = new GetScale(val, classes);
      scale = self.currentColorScale;

      self.LegendToApp(title, translate, scale)

      self.RecolorLayer(scale);
    }, false);
  }

  RecreateLegendClass(title, translate) {
    let self = this;
    let scale;
    
    // Recreate the legend if a color change is issued
    d3.select("#class-select").on("change", function () {
      self.currentClass = d3.select(this).node().value;
      self.currentColorScale = new GetScale(self.currentColor, self.currentClass);
      scale = self.currentColorScale;

      if(self.DataFromFiles != undefined){
        var currentDataFileIndex = document.getElementById('sim-select').selectedIndex;
        self.DataFromFiles[currentDataFileIndex].layerClasses = self.currentClass;
      }

      self.LegendToApp(title, translate, scale)

      self.RecolorLayer(scale);
    }, false);
  }

  RecolorLayer(scale) {
    if (this.currentSimulationLayerGeoJSON != undefined) {
      let index = (this.currentSimulationCycle != undefined) ? this.currentSimulationCycle : 0;
      this.LayerOntoMap(this.currentSimulationLayerGeoJSON, this.currentSimulationTitle, this.data[index].messages, scale.GS, false, false);
    }
  }

  /*
  Purpose: 
    - Change the current simulation being manipulated 
  Paramters:
    event - event.target.value would tell us which simulation we selected
  Information leaving the method:
    - Change previous simulation information to the current one
    - An updated color scale, number of classes, and legend
    - Simulation cycle set to the correct cycle
  */
  OnSimulationSelectChange(ev){
    this.PreviousSimulationToCurrentSimulation(document.getElementById('sim-select').selectedIndex);
    this.UpdateLegendToCurrentSimulation(Core.Nls("App_Legend_Title"), "translate(5,30)");
    this.UpdateSimulationCycleSelectorToCurrentSimulation();
  }

  PreviousSimulationToCurrentSimulation(index){
    var element = this.DataFromFiles[index];
    this.currentSimulationTitle = element.simulation;
    this.data = element.simulationData;
    this.currentSimulationLayerGeoJSON = element.GeoJSON;
    this.currentSimulationCycle = element.layerCycle;
    this.currentNumberOfClasses = element.layerClasses;
    this.currentColor = element.layerColor;
  }

  UpdateLegendToCurrentSimulation(title, translate){
    this.currentColorScale = new GetScale(this.currentColor, this.currentNumberOfClasses);
    let scale = this.currentColorScale;

    this.LayerOntoMap(this.currentSimulationLayerGeoJSON, this.currentSimulationTitle, this.data[this.currentSimulationCycle].messages, scale.GS, false, false);

    document.getElementById('colorOne').value = this.currentColor

    if(this.currentNumberOfClasses == 5){
      document.getElementById('class-select').selectedIndex = 1
    } else {
      document.getElementById('class-select').selectedIndex = 0
    }

    const svg = d3.select("svg");

    svg.selectAll("*").remove();

    svg.append("g").attr("class", title).attr("transform", translate);

    var colorLegend = d3
      .legendColor()
      .labelFormat(d3.format(".2f"))
      // To actually color the legend based on our chosen colors
      .scale(scale.GS);

    svg.select("." + title).call(colorLegend);
  }

  UpdateSimulationCycleSelectorToCurrentSimulation(){
    this.Elem("cycle").setAttribute("max", this.data.length - 1);
    this.Elem("output").textContent = this.currentSimulationCycle;
    document.getElementById("cycle").value = this.currentSimulationCycle;
  }
  
  /*
  Purpose: 
    - Change the current simulation cycle
    - Display the updated vectory layer based on simulation cycle
  Paramters:
    event - To find which simulation cycle user selected
  */
  OnCycle_Change(ev) {
    // Let the user know what cycle theyre on
    this.Elem("output").textContent = ev.target.value;

    // Update the current cycle
    this.currentSimulationCycle = ev.target.value;
    var currentDataFileIndex = document.getElementById('sim-select').selectedIndex;
    this.DataFromFiles[currentDataFileIndex].layerCycle = ev.target.value;
    

    // Access the data in the new simulation cycle
    let data = this.data[ev.target.value].messages;

    // New vector layer object that'll overwrite the vector layer object from the previous simulation cycle
    // This will overwrite the previous simulation cycle vector object and add the new one
    this.LayerOntoMap(this.currentSimulationLayerGeoJSON, this.currentSimulationTitle, data, this.currentColorScale.GS, false, false);
  }
  
  // Create the simulation object when the simulation is first introduced
  OnLayerCreation_Handler(ev) {
    var features = ev.target.getFeatures();
    this.CreateSimulation(features, this.data);
  }

  CreateSimulation(features, data) {
    // NOTE : Creates a Simulation object.
    // This is something I would usually do as a preload
    // step. You load all your data, build your simulation, then initialize the app.
    // As it is now, different pieces of data are loaded in various places so it's
    // difficult to have everything you need in one place. In addition, there is no
    // simulation structure file that contains all models, links, ports, etc. These
    // all have to be derived from the geojson and output file.
    var models = features.map((f) => {
      return new Model(f.getProperties().dauid, "atomic");
    });

    var simulation = new SimulationDEVS("hoya", "custom", "Cell-DEVS", models);

    for (var i = 0; i < data.length; i++) {
      var frame = new FrameDEVS(data[i].time);

      simulation.AddFrame(frame);

      for (var id in data[i].messages) {
        var transition = new TransitionDEVS(id, "infected", data[i].messages[id]);
        frame.AddTransition(transition);
      }
    }
    simulation.Initialize(10);

    this.transitions = createTransitionFromSimulation(simulation.frames)

    this.ArrayOfTransitions(this.transitions, this.currentSimulationTitle)

    // Let the download button be clickable
    this.Elem("btnDownload").disabled = false;

  }

  OnButtonDownload_Click(ev) {
    var index = document.getElementById('sim-download').selectedIndex
    new CreateCsvFileForDownload(this.allTransitions[index].transitionData);
  }

  Template() {
    return (
      "<div id='map' handle='map' widget='Widget.Map' class='map' ></div>" +

      // Load Simulation
      "<div handle='userdata' id='userdata'>" +
  
        "<div class='upload-btn-wrapper'>" +
          "<br><button class='downloadButton'><i class='far fa-file-text'> Choose Simulation Results File </i>" +
            "<input type='file' handle = 'simResults' name='simResults' accept='.txt'>" +
          "</button></br>"+
        "</div>" +

        // Loading Icon
        "<div id='wait' handle='wait' class='wait' hidden><img src='./assets/loading.gif'></div>" + 
  
        "<div class='upload-btn-wrapper' style='margin-top:10px;'>" +
          "<br><button handle='downlaodbtnTwo'class='downloadButtonTwo'disabled><i class='far fa-file-code-o'> Choose GeoJSON File </i>" +
            "<input type='file' name='vectorLayer' handle='vectorLayer' accept='.geojson' disabled></button></br>" +
        "</div>" +

      "</div>" +

      

      // Download data
      "<div id='download'>" +
      
      "<label for='sim-type'>Select simulation to download: </label>" +
      "<select class='select-css' handle = 'sim-download' id='sim-download'></select>" +

      '<br><br><button class="btnDownload" handle="btnDownload" title="nls(Download_Files)" disabled><i class="fa fa-download"></i> Download</button>' +

      "</div>"+

      // Manipulate simulation
      "<div class='sim-navigation' handle-'navigation' id='navigation'>" +
        
        "<div class='select-css-box' id='controls'>" +
          "<br><label for='sim-select'>Select Simulation: </label>" +
          "<select class='select-css' handle = 'selectSimulation' id='sim-select'>" +
          "</select>" +
            
        "</div>" +

        "<br><label>Select Simulation Cycle: <input handle='cycle' type='range' name='cycle' id='cycle' min='0' max = '0' step='1' value='0' >" +
        "<output handle='output' class='cycle-output' for='cycle'></output></label><br><br>" +

        "<div>" +
          "<label for='favcolor'>Select colour scale: </label>" +
          "<input type='color' id='colorOne' name='favcolor' value='#ff0000'><br>" +
        "</div>" +

        "<br><div id='classControls'><label for='class-select'>Select # of classes: </label>" +
        "<select handle = 'selectClasses' id='class-select'>" +
          "<option>4</option>" +
          "<option>5</option>" +
        "</select></div>" +

        "<br><div id='classControls'><label for='class-select'>Choose what to visualize: </label>" +
        "<select handle = 'selectClasses' id='class-select'>" +
          "<option>Susceptible</option>" +
          "<option>Infected</option>" +
          "<option>Recovered</option>" +
        "</select></div>" +
        
        
        "<legend class='svg-div'>Proportion Infected<svg id='svg' class='svg' handle='svg' width = '960' height = '150'></svg></legend>" +

      "</div>" +

      // Overlay text for vector layers
      "<div id = 'overlay-container' class='overlay-container'><span class='overlay-text' id='feature-title'>" +
      "</span><br><span class='overlay-text' id='feature-simulation'></span>" +
      "</span><br><span class='overlay-text' id='feature-name'></span>" +
      "</span><br><span class='overlay-text' id='feature-cycle'></span><br>" +

      "</span><br><span class='overlay-text' id='feature-init-pop'></span>" +
      "</span><br><span class='overlay-text' id='feature-current-pop'></span>" +
      "</span><br><span class='overlay-text' id='feature-fatal'></span><br>" +
      
      "</span><br><span class='overlay-text' id='feature-susceptible'></span>" +
      "</span><br><span class='overlay-text' id='feature-infected'></span>" +
      "</span><br><span class='overlay-text' id='feature-recovered'></span></div>" 
      
    );
  }
}
