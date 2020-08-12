package models;

import java.io.IOException;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;

import components.Utilities;
import components.ZipFile;

public class Parsed {
	public Simulation simulation;
	public List<? extends Message> messages;
	
	public Parsed(Simulation simulation, List<? extends Message> messages) {
		this.simulation = simulation;
		this.messages = messages;
	}
	
	public byte[] toZipByteArray() throws JsonProcessingException, IOException {
		ZipFile zip = new ZipFile();
		
		zip.Open();
		zip.Add("simulation.json", Utilities.JsonToByte(this.simulation));
		zip.Add("messages.csv", Utilities.MessagesToByte(this.messages));
		zip.Close();
		
		return zip.toByteArray();
	}
}