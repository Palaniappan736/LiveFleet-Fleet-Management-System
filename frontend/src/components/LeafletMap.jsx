import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const LeafletMap = ({ buses = [], center = [28.5355, 77.3910], zoom = 12 }) => {
  const [mapCenter] = useState(center);

  return (
    <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        {/* Free OpenStreetMap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Bus markers */}
        {buses.map((bus) => {
          const lat = bus.location?.latitude || bus.location?.lat || 28.5355;
          const lng = bus.location?.longitude || bus.location?.lng || 77.3910;
          const speed = bus.obd?.parameters?.speed || bus.speed || 0;
          const fuel = bus.obd?.parameters?.fuelLevel || bus.fuel || 0;
          const name = bus.busName || bus.busNumber || bus.id;
          const driver = bus.driverName || bus.driver || 'N/A';
          const route = bus.route || bus.routeId || 'N/A';
          return (
            <Marker key={bus.id} position={[lat, lng]}>
              <Popup>
                <div className="text-sm font-semibold">
                  <p className="font-bold text-blue-600">{name}</p>
                  <p className="text-gray-600">Route: {route}</p>
                  <p className="text-gray-600">Driver: {driver}</p>
                  <p className="text-green-600">Speed: {Math.round(speed)} km/h</p>
                  <p className={`font-semibold ${fuel > 30 ? 'text-green-600' : 'text-red-600'}`}>
                    Fuel: {Math.round(fuel)}%
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default LeafletMap;
