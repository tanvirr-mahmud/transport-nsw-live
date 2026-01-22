# Transport NSW Live Trip Planner

A premium, real-time public transport tracking and journey planning application for New South Wales, built with React and Vite.

## 🚀 Features

- **Live Trip Planning**: Search for journeys across the NSW transport network (Trains, Metro, Light Rail, Ferries, and Buses).
- **Real-time Vehicle Tracking**: View the live location of your train or metro on an interactive map.
- **Smart Filtering**: Filter trips by "Fastest", "Limited Stops", or show all upcoming departures.
- **Favorites**: Save your frequent journeys for quick access.
- **Live Weather**: Integrated Sydney weather and UV index information.
- **Responsive Design**: Optimised for both mobile and desktop experiences with a sleek, dark-themed UI.

## 🛠️ Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd transport-nsw-app
   ```

2. **Configure Environment Variables**:
   Copy `env.example` to `.env` and add your NSW Transport Open Data API keys:
   ```bash
   cp env.example .env
   ```
   Add your keys in `.env`:
   - `VITE_TFNSW_API_KEY`: Main API key for Trip Planner and Stop Finder.
   - `VITE_TFNSW_VEHICLE_POS_API_KEY`: (Optional) Key for GTFS Realtime Vehicle Positions.
   - `VITE_TFNSW_TRIP_UPDATES_API_KEY`: (Optional) Key for GTFS Realtime Trip Updates.
   - `VITE_OPENWEATHER_API_KEY`: (Optional) Key for weather data from OpenWeatherMap.

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

## 📝 Technical Notes

- **Proxying**: The application utilizes Vite's proxy configuration to handle requests to the Transport NSW APIs, avoiding CORS issues during development.
- **Real-time Data**: Real-time vehicle positions are fetched from GTFS Realtime feeds and matched with planned trips for accurate tracking.
- **Mapping**: Interactive maps are powered by React-Leaflet and OpenStreetMap data.

## ⚖️ License

Private Project. Created by Tanvir.
