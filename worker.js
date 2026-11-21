// 8. Serve React frontend
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Frontend assets not bound. Deploy via Git/Wrangler.", { status: 500 });
