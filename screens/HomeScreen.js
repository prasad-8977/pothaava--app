import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db, auth } from '../App';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const OWNER_COMMISSION = 5; // Nee commission prati ride ki ₹5

export default function HomeScreen() {
  const [location, setLocation] = useState(null);
  const [rideType, setRideType] = useState('uber'); // 'uber' or 'rapido'
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [fare, setFare] = useState(0);
  const [distance, setDistance] = useState(0);

  // Vizag default location - Beach Road
  const vizagRegion = {
    latitude: 17.6868,
    longitude: 83.2185,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access cheyyali ra');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setPickup({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  // Distance calculate - Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // UBER FARE - Vizag rates
  const calculateUberFare = (dist) => {
    const baseFare = 40;
    const perKm = 12;
    const perMin = 2;
    const time = dist * 3; // avg 3 min per km Vizag traffic lo
    const total = baseFare + (dist * perKm) + (time * perMin);
    return Math.round(total + OWNER_COMMISSION); // +₹5 nee commission
  };

  // RAPIDO FARE - Bike taxi rates
  const calculateRapidoFare = (dist) => {
    const baseFare = 25;
    const perKm = 8;
    const perMin = 1.5;
    const time = dist * 2.5; // bike faster
    const total = baseFare + (dist * perKm) + (time * perMin);
    return Math.round(total + OWNER_COMMISSION); // +₹5 nee commission
  };

  const handleMapPress = (e) => {
    if (!pickup) {
      setPickup(e.nativeEvent.coordinate);
    } else if (!drop) {
      setDrop(e.nativeEvent.coordinate);
      const dist = calculateDistance(
        pickup.latitude, pickup.longitude,
        e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude
      );
      setDistance(dist.toFixed(2));
      setFare(rideType === 'uber' ? calculateUberFare(dist) : calculateRapidoFare(dist));
    }
  };

  const bookRide = async () => {
    if (!pickup || !drop) {
      Alert.alert('Error', 'Pickup & Drop select chey ra');
      return;
    }
    
    try {
      await addDoc(collection(db, 'rides'), {
        userId: auth.currentUser?.uid || 'guest',
        rideType,
        pickup,
        drop,
        distance: parseFloat(distance),
        fare,
        ownerCommission: OWNER_COMMISSION,
        status: 'requested',
        createdAt: serverTimestamp(),
        city: 'Vizag'
      });
      Alert.alert('Booked!', `₹${fare} - Driver vastunnadu. Nee commission: ₹${OWNER_COMMISSION}`);
      setDrop(null);
      setFare(0);
    } catch (error) {
      Alert.alert('Error', 'Booking fail ayyindi');
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={location ? { ...location, latitudeDelta: 0.05, longitudeDelta: 0.05 } : vizagRegion}
        onPress={handleMapPress}
      >
        {pickup && <Marker coordinate={pickup} title="Pickup" pinColor="green" />}
        {drop && <Marker coordinate={drop} title="Drop" pinColor="red" />}
      </MapView>

      <View style={styles.bottomSheet}>
        <Text style={styles.title}>Pothaava? v2.0 - Vizag</Text>
        
        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleBtn, rideType === 'uber' && styles.activeBtn]} 
            onPress={() => { setRideType('uber'); if(drop) setFare(calculateUberFare(parseFloat(distance))); }}
          >
            <Text style={styles.btnText}>🚗 Uber Car</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, rideType === 'rapido' && styles.activeBtn]} 
            onPress={() => { setRideType('rapido'); if(drop) setFare(calculateRapidoFare(parseFloat(distance))); }}
          >
            <Text style={styles.btnText}>🏍️ Rapido Bike</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.info}>Distance: {distance} km</Text>
        <Text style={styles.fare}>Fare: ₹{fare} <Text style={styles.commission}>(+₹{OWNER_COMMISSION} for Owner)</Text></Text>

        <TouchableOpacity style={styles.bookBtn} onPress={bookRide}>
          <Text style={styles.bookText}>Book {rideType === 'uber' ? 'Uber' : 'Rapido'} Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
  },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
  toggleBtn: { padding: 12, backgroundColor: '#eee', borderRadius: 10, width: '45%' },
  activeBtn: { backgroundColor: '#007AFF' },
  btnText: { textAlign: 'center', fontWeight: '600' },
  info: { fontSize: 16, marginVertical: 5 },
  fare: { fontSize: 24, fontWeight: 'bold', marginVertical: 5 },
  commission: { fontSize: 12, color: 'green' },
  bookBtn: { backgroundColor: '#000', padding: 15, borderRadius: 10, marginTop: 10 },
  bookText: { color: 'white', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
});
