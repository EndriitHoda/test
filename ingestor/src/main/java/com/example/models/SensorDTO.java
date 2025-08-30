package com.example.models;

import lombok.Data;

import java.util.Date;
import java.util.List;

@Data
public class SensorDTO {
  private String id;
  private String type;
  private Location location;
  private Date lastUpdated;

  // Type-specific fields
  private String roadSegmentId;
  private Integer laneNumber;
  private String direction;
  private Double height;
  private String areaType;
  private String roadName;
  private String quality;

  @Data
  public static class Location {
    private String type = "Point";
    private List<Double> coordinates;
  }

  // Helper methods
  public Double getLongitude() {
    return location != null && location.coordinates != null && location.coordinates.size() > 0
        ? location.coordinates.get(0)
        : null;
  }

  public Double getLatitude() {
    return location != null && location.coordinates != null && location.coordinates.size() > 1
        ? location.coordinates.get(0)
        : null;
  }
}
