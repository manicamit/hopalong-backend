import jwt from "jsonwebtoken";

interface PublishOptions {
  channel: string;
  data: any;
}

export class CentrifugoClient {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.CENTRIFUGO_API_KEY || "";
    this.apiUrl =
      process.env.CENTRIFUGO_HTTP_URL || "http://localhost:8000/api";

    if (!this.apiKey) {
      console.warn("Centrifugo API Key not set in environment variables");
    }
  }

  async publish({ channel, data }: PublishOptions): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `apikey ${this.apiKey}`,
        },
        body: JSON.stringify({
          method: "publish",
          params: {
            channel,
            data,
          },
        }),
      });

      const result = await response.json();
      return !result.error;
    } catch (error) {
      console.error("Error publishing to Centrifugo:", error);
      return false;
    }
  }

  generateConnectionToken(userId: string, expireSeconds = 3600): string {
    const claims = {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + expireSeconds,
    };

    const secret = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET || "";
    return jwt.sign(claims, secret);
  }

  generateChannelToken(
    userId: string,
    channel: string,
    expireSeconds = 3600
  ): string {
    const claims = {
      sub: userId,
      channel,
      exp: Math.floor(Date.now() / 1000) + expireSeconds,
    };

    const secret = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET || "";
    return jwt.sign(claims, secret);
  }
}

// Create a singleton instance
let centrifugoClientInstance: CentrifugoClient | null = null;

export const getCentrifugoClient = (): CentrifugoClient => {
  if (!centrifugoClientInstance) {
    centrifugoClientInstance = new CentrifugoClient();
  }
  return centrifugoClientInstance;
};
