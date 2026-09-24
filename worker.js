export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow browser requests from your website
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // Payment verification endpoint
    if (
      url.pathname === "/verify" &&
      request.method === "GET"
    ) {
      const reference = url.searchParams.get("reference");

      if (!reference) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Missing payment reference"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      try {
        const response = await fetch(
          `https://api.lenco.co/access/v2/collections/status/${encodeURIComponent(reference)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${env.LENCO_SECRET_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        const data = await response.json();

        return new Response(
          JSON.stringify(data),
          {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to verify payment"
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "Lenco payment worker is running"
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
};