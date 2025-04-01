// geoCodingController.ts
import { Request, Response } from "express";

export class GeoCodingController {
  static async getCoordinates(req: Request, res: Response) {
    try {
      // Get address from query parameters
      const address = req.query.address as string;

      // Validate address parameter
      if (
        !address ||
        typeof address !== "string" ||
        address.trim().length === 0
      ) {
        res.status(400).json({
          success: false,
          message: "Valid address query parameter is required",
        });
        return;
      }

      const apiKey = "31818684b71a45abb82218a0ffdcec6d";
      const filter = "countrycode:in";
      const limit = 1;
      const bias = "proximity:9.754833,76.650099";
      const baseUrl = "https://api.geoapify.com/v1/geocode/search";
      const encodedAddress = encodeURIComponent(address.trim());

      const requestOptions = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const url = `${baseUrl}?text=${encodedAddress}&filter=${filter}&limit=${limit}&bias=${bias}&apiKey=${apiKey}`;
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract latitude and longitude from the response
      const feature = data?.features?.[0];
      if (!feature || !feature.geometry || !feature.geometry.coordinates) {
        res.status(200).json({
          success: false,
          message: "No valid geocoding data found",
        });
        return;
      }

      const [lon, lat] = feature.geometry.coordinates;

      res.status(200).json({
        success: true,
        lat,
        lon,
      });
    } catch (error) {
      console.error("Geocoding error:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to retrieve geocoding data",
      });
    }
  }
}

export default GeoCodingController;
