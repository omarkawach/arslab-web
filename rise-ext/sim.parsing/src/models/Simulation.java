package models;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class Simulation implements Serializable {

	private static final long serialVersionUID = 4L;
	
	public String name;
	public String type;
	public String simulator;
	public List<? extends Model> models;
	
	public String getName() {
		return this.name;
	}

	public String getType() {
		return this.type;
	}

	public String getSimulator() {
		return this.simulator;
	}

	public List<? extends Model> getModels() {
		return this.models;
	}
	
    public Simulation(String name, String type, String simulator, List<? extends Model> models) {
        this.name = name;
        this.type = type;
        this.simulator = simulator;
        this.models = models;
    }
    
    public Simulation() { 
    	this("","","",new ArrayList<Model>()); 
    }
}