import axios from "axios";
import {
  lineString,
  lineIntersect,
  lineOverlap,
  buffer,
  booleanPointInPolygon,
} from "@turf/turf";
import {
  Feature,
  LineString,
  Position,
  Polygon,
  Point,
  MultiPolygon,
} from "geojson";

import dotenv from "dotenv";

dotenv.config();
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
const GEOAPIFY_URL = "https://api.geoapify.com/v1/routing";

// Utility function to log large arrays in a concise way
function logArray(array: any[], name = "Array"): void {
  if (!Array.isArray(array)) {
    console.log(`${name}:`, array);
    return;
  }

  if (array.length <= 10) {
    console.log(`${name} (${array.length} items):`, array);
  } else {
    console.log(
      `${name} (${array.length} items): first 5:`,
      array.slice(0, 5),
      "... last 5:",
      array.slice(-5)
    );
  }
}

function findSegmentsInsideBuffer(
  route: Feature<LineString>,
  bufferPolygon: Feature<Polygon | MultiPolygon>
): Feature<LineString>[] {
  const segments: Feature<LineString>[] = [];
  const coordinates: Position[] = route.geometry.coordinates;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start: Position = coordinates[i];
    const end: Position = coordinates[i + 1];
    // Calculate the midpoint of the segment
    const midPoint: Position = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
    ];
    // Check if the midpoint is inside the buffer
    if (booleanPointInPolygon(midPoint, bufferPolygon)) {
      segments.push(lineString([start, end]));
    }
  }
  return segments;
}

// Forgiving matching function to match segments within a given distance
interface MatchResult {
  overlap: boolean;
  overlappingSegments1: Feature<LineString>[];
  overlappingSegments2: Feature<LineString>[];
}

function forgivingMatch(
  route1: Feature<LineString>,
  route2: Feature<LineString>,
  distance: number = 1 // Reduced from 3km to 1km for stricter matching
): MatchResult {
  // Create a buffer around route1
  const buffer1: Feature<Polygon | MultiPolygon> = buffer(route1, distance, {
    units: "kilometers",
  })!;
  // Find segments of route2 within buffer1
  const overlappingSegments2: Feature<LineString>[] = findSegmentsInsideBuffer(
    route2,
    buffer1
  );

  // Create a buffer around route2
  const buffer2: Feature<Polygon | MultiPolygon> = buffer(route2, distance, {
    units: "kilometers",
  })!;
  // Find segments of route1 within buffer2
  const overlappingSegments1: Feature<LineString>[] = findSegmentsInsideBuffer(
    route1,
    buffer2
  );

  // Determine if there's any overlap
  const overlap: boolean =
    overlappingSegments1.length > 0 || overlappingSegments2.length > 0;

  return {
    overlap,
    overlappingSegments1, // Parts of route1 within buffer of route2
    overlappingSegments2, // Parts of route2 within buffer of route1
  };
}

// Define types for the Geoapify API response
interface GeoapifyFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: Position[] | Position[][];
  };
  properties: Record<string, any>;
}

interface GeoapifyResponse {
  type: string;
  features: GeoapifyFeature[];
}

// Function to get multiple alternative routes from Geoapify
async function getRoutes(
  start: string,
  end: string
): Promise<Feature<LineString>[]> {
  console.log(
    `Fetching multiple routes from Geoapify for start: ${start}, end: ${end}`
  );
  try {
    const response = await axios.get<GeoapifyResponse>(GEOAPIFY_URL, {
      params: {
        waypoints: `${start}|${end}`,
        mode: "drive",
        alternative_routes: true, // Get multiple routes
        max_alternatives: 4, // Return 5 routes (1 main + 4 alternatives)
        apiKey: GEOAPIFY_API_KEY,
        format: "geojson",
      },
    });

    console.log("Geoapify alternative routes response received");
    if (
      !response.data ||
      !response.data.features ||
      response.data.features.length === 0
    ) {
      console.error("Failed to fetch routes: No features in response");
      throw new Error("Failed to fetch routes");
    }

    console.log(`Found ${response.data.features.length} alternative routes`);

    // Extract all route coordinates and return as an array of GeoJSON lineStrings
    const routes = response.data.features.map((route) => {
      // Handle potentially nested coordinates
      const coordinates = route.geometry.coordinates;
      const flattenedCoords: Position[] = Array.isArray(coordinates[0][0])
        ? (coordinates[0] as Position[])
        : (coordinates as Position[]);

      // Log first and last 10 coordinates for each route
      console.log(
        "First 10 coordinates of the route:",
        flattenedCoords.slice(0, 20)
      );
      console.log(
        "Last 10 coordinates of the route:",
        flattenedCoords.slice(-20)
      );

      return lineString(flattenedCoords);
    });

    return routes;
  } catch (error) {
    console.error(
      "Error fetching routes:",
      error instanceof Error ? error.message : String(error)
    );
    throw new Error("Could not fetch route data");
  }
}

// Function to check if coordinates are within IIIT Kottayam campus bounds
function isWithinIIITK(lon: number, lat: number): boolean {
  // Convert the DMS coordinates to decimal degrees
  // North corner: 9°45'32.7"N 76°38'45.5"E = 9.759083, 76.646028
  // South corner: 9°44'58.8"N 76°39'10.4"E = 9.749667, 76.652889

  const north = 9.759083;
  const south = 9.749667;
  const west = 76.646028;
  const east = 76.652889;

  return lat >= south && lat <= north && lon >= west && lon <= east;
}

// Function to get address from coordinates using Geoapify Reverse Geocoding API
async function getAddressFromCoordinates(
  coordinates: Position
): Promise<string> {
  console.log(`Getting address for coordinates: [${coordinates}]`);
  try {
    const [lon, lat] = coordinates;

    // Check if coordinates are within IIIT Kottayam campus
    if (isWithinIIITK(lon, lat)) {
      console.log("Coordinates match IIIT Kottayam campus");
      return "IIIT Kottayam, Valavoor, Meenachil";
    }

    const response = await axios.get(
      "https://api.geoapify.com/v1/geocode/reverse",
      {
        params: {
          lat: lat,
          lon: lon,
          format: "json",
          apiKey: GEOAPIFY_API_KEY,
        },
      }
    );

    if (
      response.data &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      const result = response.data.results[0];
      // Format the address as "street, city, county"
      const name = result.name || "Unknown Street";
      const city = result.city || "Unknown City";
      const county = result.county || "Unknown County";
      return `${name}, ${city}, ${county}`;
    } else {
      return "Address not found";
    }
  } catch (error) {
    console.error("Error getting address:", error);
    return "Error getting address";
  }
}

interface BestOverlap {
  overlap: boolean;
  overlappingSegments: Feature<LineString>[];
  overlapSegmentCount: number;
  totalOverlapLength: number;
  forgivingMatch?: boolean;
  matchDistance?: number;
  firstPointAddress?: string;
  lastPointAddress?: string;
}

// Main function to check overlap between routes
export async function checkRouteOverlap(
  user1Start: string,
  user1End: string,
  user2Start: string,
  user2End: string
): Promise<{
  overlap: boolean;
  overlapSegments: Position[][];
  overlapSegmentCount: number;
  totalOverlapLength: number;
  firstPointAddress?: string;
  lastPointAddress?: string;
  overlapPercentage: number;
}> {
  try {
    // Get multiple routes for both users
    console.log("Fetching routes for User 1...");
    const routes1 = await getRoutes(user1Start, user1End);
    console.log(`Retrieved ${routes1.length} routes for User 1`);

    console.log("Fetching routes for User 2...");
    const routes2 = await getRoutes(user2Start, user2End);
    console.log(`Retrieved ${routes2.length} routes for User 2`);

    // Find the best overlap among all route combinations
    console.log(
      "Checking for overlaps between all route combinations with 1km proximity..."
    );
    let bestOverlap: BestOverlap = {
      overlap: false,
      overlappingSegments: [],
      overlapSegmentCount: 0,
      totalOverlapLength: 0,
    };
    let maxOverlapLength = 0;

    for (const route1 of routes1) {
      for (const route2 of routes2) {
        const matchResult = forgivingMatch(route1, route2, 1); // Using 1km buffer instead of 3km
        if (matchResult.overlap) {
          // Calculate metrics for this overlap
          const overlapSegmentCount =
            matchResult.overlappingSegments1.length +
            matchResult.overlappingSegments2.length;
          const totalOverlapLength =
            matchResult.overlappingSegments1.reduce(
              (sum, seg) => sum + seg.geometry.coordinates.length,
              0
            ) +
            matchResult.overlappingSegments2.reduce(
              (sum, seg) => sum + seg.geometry.coordinates.length,
              0
            );

          // Update best overlap if this one is better
          if (totalOverlapLength > maxOverlapLength) {
            maxOverlapLength = totalOverlapLength;
            bestOverlap = {
              overlap: true,
              overlappingSegments: [
                ...matchResult.overlappingSegments1,
                ...matchResult.overlappingSegments2,
              ],
              overlapSegmentCount,
              totalOverlapLength,
              forgivingMatch: true,
              matchDistance: 1,
            };
          }
        }
      }
    }

    // Calculate total route length to determine percentage - improved calculation
    const route1Length = routes1[0].geometry.coordinates.length;
    const route2Length = routes2[0].geometry.coordinates.length;
    // Use the smaller route length as the denominator for a stricter percentage
    const shorterRouteLength = Math.min(route1Length, route2Length);

    // Ensure we don't double count overlap in percentage calculation
    // Cap the overlap at the shorter route's length to avoid percentages > 100%
    const adjustedOverlapLength = Math.min(
      bestOverlap.totalOverlapLength,
      shorterRouteLength
    );
    const overlapPercentage =
      shorterRouteLength > 0
        ? (adjustedOverlapLength / shorterRouteLength) * 100
        : 0;

    // Get addresses for overlapping segments if overlap exists
    if (bestOverlap.overlap && bestOverlap.overlappingSegments.length > 0) {
      const firstSegment = bestOverlap.overlappingSegments[0];
      const lastSegment =
        bestOverlap.overlappingSegments[
          bestOverlap.overlappingSegments.length - 1
        ];
      const firstPoint = firstSegment.geometry.coordinates[0];
      const lastPoint =
        lastSegment.geometry.coordinates[
          lastSegment.geometry.coordinates.length - 1
        ];

      const firstPointAddress = await getAddressFromCoordinates(firstPoint);
      const lastPointAddress = await getAddressFromCoordinates(lastPoint);

      return {
        overlap: true,
        overlapSegments: bestOverlap.overlappingSegments.map(
          (seg) => seg.geometry.coordinates
        ),
        overlapSegmentCount: bestOverlap.overlapSegmentCount,
        totalOverlapLength: bestOverlap.totalOverlapLength,
        firstPointAddress,
        lastPointAddress,
        overlapPercentage,
      };
    }

    return {
      overlap: bestOverlap.overlap,
      overlapSegments: [],
      overlapSegmentCount: 0,
      totalOverlapLength: 0,
      overlapPercentage: 0,
    };
  } catch (error) {
    console.error("Error in checkRouteOverlap:", error);
    throw error;
  }
}

// Export other useful functions
export { getRoutes, getAddressFromCoordinates, isWithinIIITK };
