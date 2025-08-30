package com.example;

import java.util.List;
import java.util.Optional;

import com.example.models.SensorDTO;
import io.quarkus.logging.Log;
import io.quarkus.mongodb.reactive.ReactiveMongoClient;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import io.smallrye.reactive.messaging.MutinyEmitter;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Channel;

import io.vertx.core.json.JsonObject;

@Path("/")
@ApplicationScoped
public class IngestDataResource {

  @Inject
  @Channel("sensor-data")
  MutinyEmitter<JsonObject> sensorDataEmitter;

  @ConfigProperty(name = "quarkus.mongodb.database")
  String DATABASE;

  @Inject
  ReactiveMongoClient mongoClient;

  @GET
  @Path("/sensors")
  @Produces(MediaType.APPLICATION_JSON)
  public Uni<List<SensorDTO>> getSensors() {
    return mongoClient.getDatabase(DATABASE)
        .getCollection("sensor-config", SensorDTO.class)
        .find()
        .collect()
        .asList();
  }

  @POST
  @Path("/ingest")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  public Uni<Response> ingest(List<JsonObject> data) {
    if (data == null || data.isEmpty()) {
      return Uni.createFrom().item(
          Response.status(Response.Status.BAD_REQUEST)
              .entity(new JsonObject().put("error", "Request body must be a non-empty JSON array."))
              .build()
      );
    }

    Log.infof("Received a batch of %d records.", data.size());

    return Multi.createFrom().iterable(data)
        .onItem().transformToUniAndMerge(record -> sensorDataEmitter.send(record))
        .collect().asList() // Collect to wait for all sends to complete
        .onItem().transform(sentItems ->
            Response.accepted(new JsonObject()
                    .put("status", "success")
                    .put("records_accepted", sentItems.size()))
                .build()
        )
        .onFailure().recoverWithItem(e -> {
          Log.error("Failed to send records to Kafka emitter", e);
          return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
              .entity(new JsonObject().put("error", "Failed to process batch due to an internal error."))
              .build();
        });
  }
}