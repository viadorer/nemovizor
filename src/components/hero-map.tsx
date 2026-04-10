"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const LOCATIONS = [
  // Česko
  { name: "Praha", lat: 50.0755, lon: 14.4378, zoom: 14 },
  { name: "Brno", lat: 49.1951, lon: 16.6068, zoom: 14 },
  { name: "Ostrava", lat: 49.8209, lon: 18.2625, zoom: 14 },
  { name: "Plzeň", lat: 49.7384, lon: 13.3736, zoom: 14 },
  { name: "Olomouc", lat: 49.5938, lon: 17.2509, zoom: 14 },
  { name: "Liberec", lat: 50.7671, lon: 15.0562, zoom: 14 },
  { name: "České Budějovice", lat: 48.9745, lon: 14.4744, zoom: 14 },
  { name: "Hradec Králové", lat: 50.2092, lon: 15.8327, zoom: 14 },
  { name: "Karlovy Vary", lat: 50.2309, lon: 12.8719, zoom: 14 },
  { name: "Ústí nad Labem", lat: 50.6607, lon: 14.0323, zoom: 14 },
  { name: "Pardubice", lat: 50.0343, lon: 15.7812, zoom: 14 },
  { name: "Zlín", lat: 49.2265, lon: 17.6670, zoom: 14 },
  { name: "Jihlava", lat: 49.3961, lon: 15.5912, zoom: 14 },
  { name: "Český Krumlov", lat: 48.8127, lon: 14.3175, zoom: 15 },
  { name: "Kutná Hora", lat: 49.9481, lon: 15.2682, zoom: 15 },
  { name: "Telč", lat: 49.1842, lon: 15.4529, zoom: 15 },
  { name: "Mikulov", lat: 48.8058, lon: 16.6378, zoom: 15 },
  { name: "Mariánské Lázně", lat: 49.9646, lon: 12.7012, zoom: 15 },
  // Slovensko
  { name: "Bratislava", lat: 48.1486, lon: 17.1077, zoom: 14 },
  { name: "Košice", lat: 48.7164, lon: 21.2611, zoom: 14 },
  // Španělsko
  { name: "Barcelona", lat: 41.3874, lon: 2.1686, zoom: 14 },
  { name: "Madrid", lat: 40.4168, lon: -3.7038, zoom: 14 },
  { name: "Marbella", lat: 36.5099, lon: -4.8862, zoom: 14 },
  { name: "Valencia", lat: 39.4699, lon: -0.3763, zoom: 14 },
  { name: "Málaga", lat: 36.7213, lon: -4.4214, zoom: 14 },
  // Francie
  { name: "Paris", lat: 48.8566, lon: 2.3522, zoom: 13 },
  { name: "Nice", lat: 43.7102, lon: 7.2620, zoom: 14 },
  { name: "Lyon", lat: 45.7640, lon: 4.8357, zoom: 14 },
  // Itálie
  { name: "Roma", lat: 41.9028, lon: 12.4964, zoom: 13 },
  { name: "Milano", lat: 45.4642, lon: 9.1900, zoom: 14 },
  { name: "Firenze", lat: 43.7696, lon: 11.2558, zoom: 14 },
  // Německo
  { name: "Berlin", lat: 52.5200, lon: 13.4050, zoom: 13 },
  { name: "München", lat: 48.1351, lon: 11.5820, zoom: 14 },
  { name: "Hamburg", lat: 53.5511, lon: 9.9937, zoom: 13 },
  // Velká Británie
  { name: "London", lat: 51.5074, lon: -0.1278, zoom: 13 },
  { name: "Manchester", lat: 53.4808, lon: -2.2426, zoom: 14 },
  { name: "Edinburgh", lat: 55.9533, lon: -3.1883, zoom: 14 },
  // Polsko
  { name: "Warszawa", lat: 52.2297, lon: 21.0122, zoom: 14 },
  { name: "Kraków", lat: 50.0647, lon: 19.9450, zoom: 14 },
  // Portugalsko
  { name: "Lisboa", lat: 38.7223, lon: -9.1393, zoom: 14 },
  { name: "Porto", lat: 41.1579, lon: -8.6291, zoom: 14 },
  // Rakousko
  { name: "Wien", lat: 48.2082, lon: 16.3738, zoom: 14 },
  // Chorvatsko
  { name: "Zagreb", lat: 45.8150, lon: 15.9819, zoom: 14 },
  { name: "Split", lat: 43.5081, lon: 16.4402, zoom: 14 },
  // Řecko
  { name: "Athény", lat: 37.9838, lon: 23.7275, zoom: 14 },
];

const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export default function HeroMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";

    const map = L.map(containerRef.current, {
      center: [loc.lat, loc.lon],
      zoom: loc.zoom,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      fadeAnimation: true,
    });

    L.tileLayer(isDark ? TILE_DARK : TILE_SATELLITE, { maxZoom: 19 }).addTo(map);
    mapRef.current = map;

    // Theme changes
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.getAttribute("data-theme") !== "light";
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) map.removeLayer(layer);
      });
      L.tileLayer(nowDark ? TILE_DARK : TILE_SATELLITE, { maxZoom: 19 }).addTo(map);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="hero-map"
      aria-hidden="true"
    />
  );
}
