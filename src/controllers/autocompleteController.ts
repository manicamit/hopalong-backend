import { Request, Response } from "express";

export class AutocompleteController {
  static async getAddressSuggestions(req: Request, res: Response) {
    try {
      // Get address from request body
      const { address } = req.body;
      console.log(req.body);
      // Validate address parameter
      if (
        !address ||
        typeof address !== "string" ||
        address.trim().length === 0
      ) {
        res.status(400).json({
          success: false,
          message: "Valid address in request body is required",
        });
        return;
      }

      const apiKey = process.env.GEOAPIFY_API_KEY;
      const filter = "rect:73.711,8.333,78.374,12.520"; // Rectangle filter as specified
      const bias = "proximity:76.650099,9.754833"; // Bias as specified
      const baseUrl = "https://api.geoapify.com/v1/geocode/autocomplete";
      const encodedAddress = encodeURIComponent(address.trim());

      const requestOptions = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const url = `${baseUrl}?text=${encodedAddress}&filter=${filter}&bias=${bias}&format=json&apiKey=${apiKey}`;
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);

      // Process and format the results
      const suggestions =
        data?.results?.map((feature: any) => {
          const properties = feature;
          return {
            rank: properties.rank?.confidence,
            name: properties.name,
            city: properties.city,
            street: properties.street,
            houseNumber: properties.housenumber,
            formatted: properties.formatted,
            lat: properties.lat,
            lon: properties.lon,
          };
        }) || [];

      res.status(200).json({
        success: true,
        payload: suggestions,
      });
    } catch (error) {
      console.error("Autocomplete error:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to retrieve autocomplete suggestions",
      });
    }
  }
}

export default AutocompleteController;
