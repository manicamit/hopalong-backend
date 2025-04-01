import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

export class RouteMatchController {
  static async saveRoute(req: Request, res: Response) {
    const { creator, start, end, category = "amenity" } = req.body; // Default category to 'amenity'

    try {
      // Validate input
      if (
        !start ||
        !end ||
        typeof start !== "string" ||
        typeof end !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid start and end addresses are required",
        });
      }

      const apiKey = process.env.GEOAPIFY_API_KEY;
      if (!apiKey) {
        throw new Error("Geoapify API key is not set in environment variables");
      }

      const geocodeUrl = "https://api.geoapify.com/v1/geocode/search";
      const routingUrl = "https://api.geoapify.com/v1/routing";
      const placesUrl = "https://api.geoapify.com/v2/places";

      const requestOptions = {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      };

      // Step 1: Geocode start and end addresses
      const startResponse = await fetch(
        `${geocodeUrl}?text=${encodeURIComponent(start)}&apiKey=${apiKey}`,
        requestOptions
      );
      const endResponse = await fetch(
        `${geocodeUrl}?text=${encodeURIComponent(end)}&apiKey=${apiKey}`,
        requestOptions
      );

      if (!startResponse.ok || !endResponse.ok) {
        throw new Error("Geocoding failed");
      }

      const startData = await startResponse.json();
      const endData = await endResponse.json();
      const startCoords = startData.features[0]?.geometry?.coordinates; // [lon, lat]
      const endCoords = endData.features[0]?.geometry?.coordinates;

      if (!startCoords || !endCoords) {
        return res.status(400).json({
          success: false,
          message: "Could not geocode one or both addresses",
        });
      }

      const startLat = startCoords[1];
      const startLon = startCoords[0];
      const endLat = endCoords[1];
      const endLon = endCoords[0];

      // Step 2: Get route geometry
      const routeResponse = await fetch(
        `${routingUrl}?waypoints=${startLat},${startLon}|${endLat},${endLon}&mode=drive&apiKey=${apiKey}`,
        requestOptions
      );

      if (!routeResponse.ok) {
        throw new Error(`Routing error! status: ${routeResponse.status}`);
      }

      const routeData = await routeResponse.json();
      const routeCoordinates = routeData.features[0].geometry.coordinates; // Array of [lon, lat]

      // Step 3: Sample coordinates and find places
      const placesSet = new Set<string>(); // Avoid duplicates
      const placeDetails: { name: string; lon: number; lat: number }[] = [];

      // Sample every nth coordinate to get ~10 points
      const step = Math.max(1, Math.floor(routeCoordinates.length / 10));
      for (let i = 0; i < routeCoordinates.length; i += step) {
        const [lon, lat] = routeCoordinates[i];
        const radius = 5000; // 5km radius

        // Query Places API around this coordinate
        const placesResponse = await fetch(
          `${placesUrl}?filter=circle:${lon},${lat},${radius}&categories=${category}&limit=10&apiKey=${apiKey}`,
          requestOptions
        );

        if (!placesResponse.ok) continue; // Skip on error

        const placesData = await placesResponse.json();
        for (const place of placesData.features) {
          const name =
            place.properties.name ||
            place.properties.city ||
            place.properties.town;
          if (name && !placesSet.has(name)) {
            placesSet.add(name);
            placeDetails.push({
              name,
              lon: place.geometry.coordinates[0],
              lat: place.geometry.coordinates[1],
            });
          }
        }
      }

      // Step 4: Save the route and places to the database
      const newRoute = await client.route.create({
        data: {
          creator,
          start,
          end,
          startLat,
          startLon,
          endLat,
          endLon,
          places: {
            create: placeDetails.map((place) => ({
              name: place.name,
              longitude: place.lon,
              latitude: place.lat,
            })),
          },
        },
        include: { places: true }, // Include related places in the response
      });

      res.status(201).json({
        success: true,
        routeId: newRoute.id,
        places: placeDetails,
        message: "Route and places stored successfully",
      });
    } catch (error) {
      console.error("Error saving route:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to save route",
      });
    }
  }

  static async matchRoute(req: Request, res: Response) {
    const { start, end } = req.body;

    try {
      const routes = await client.route.findMany({
        where: { start, end },
        include: { places: true }, // Include related places
      });

      res.status(200).json({
        success: true,
        payload: routes,
      });
    } catch (error) {
      console.error("Error matching route:", error);
      res.status(500).json({
        success: false,
        message: "Failed to match route",
      });
    }
  }
}

export default RouteMatchController;
