import { useState, useEffect } from 'react';
import {
  fetchUgandaDistricts,
  fetchAllSubcounties,
  fetchParishes,
  fetchVillages,
  type DistrictWithId,
} from '../services/geonamesService';

export interface UgandaLocationState {
  districts: DistrictWithId[];
  subcounties: { name: string; geonameId?: number }[];
  parishes: { name: string; geonameId?: number }[];
  villages: string[];
  loadingDistricts: boolean;
  loadingSubcounties: boolean;
  loadingParishes: boolean;
  loadingVillages: boolean;
  selectedDistrict: string;
  selectedSubcounty: string;
  selectedParish: string;
  selectedVillage: string;
  setDistrict: (name: string) => void;
  setSubcounty: (name: string) => void;
  setParish: (name: string) => void;
  setVillage: (name: string) => void;
  initValues: (district: string, subcounty: string, parish: string, village: string) => void;
}

export function useUgandaLocation(): UgandaLocationState {
  const [districts, setDistricts] = useState<DistrictWithId[]>([]);
  const [subcounties, setSubcounties] = useState<{ name: string; geonameId?: number }[]>([]);
  const [parishes, setParishes] = useState<{ name: string; geonameId?: number }[]>([]);
  const [villages, setVillages] = useState<string[]>([]);

  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubcounties, setLoadingSubcounties] = useState(false);
  const [loadingParishes, setLoadingParishes] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSubcounty, setSelectedSubcounty] = useState('');
  const [selectedParish, setSelectedParish] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');

  // Load districts and all sub-counties once on mount
  useEffect(() => {
    setLoadingDistricts(true);
    fetchUgandaDistricts()
      .then(setDistricts)
      .finally(() => setLoadingDistricts(false));

    setLoadingSubcounties(true);
    fetchAllSubcounties()
      .then(setSubcounties)
      .finally(() => setLoadingSubcounties(false));
  }, []);

  // Parishes cascade from selected sub-county
  useEffect(() => {
    if (!selectedSubcounty) { setParishes([]); setVillages([]); return; }
    const sub = subcounties.find(s => s.name === selectedSubcounty);
    setLoadingParishes(true);
    setParishes([]); setVillages([]);
    fetchParishes(selectedSubcounty, sub?.geonameId, selectedDistrict)
      .then(setParishes)
      .finally(() => setLoadingParishes(false));
  }, [selectedSubcounty, subcounties, selectedDistrict]);

  // Villages cascade from selected parish
  useEffect(() => {
    if (!selectedParish) { setVillages([]); return; }
    const par = parishes.find(p => p.name === selectedParish);
    setLoadingVillages(true);
    setVillages([]);
    fetchVillages(selectedParish, par?.geonameId, selectedDistrict)
      .then(setVillages)
      .finally(() => setLoadingVillages(false));
  }, [selectedParish, parishes, selectedDistrict]);

  const setDistrict = (name: string) => {
    setSelectedDistrict(name);
    setSelectedSubcounty(''); setSelectedParish(''); setSelectedVillage('');
  };
  const setSubcounty = (name: string) => {
    setSelectedSubcounty(name); setSelectedParish(''); setSelectedVillage('');
  };
  const setParish = (name: string) => {
    setSelectedParish(name); setSelectedVillage('');
  };
  const setVillage = (name: string) => setSelectedVillage(name);

  const initValues = (district: string, subcounty: string, parish: string, village: string) => {
    setSelectedDistrict(district);
    setSelectedSubcounty(subcounty);
    setSelectedParish(parish);
    setSelectedVillage(village);
  };

  return {
    districts, subcounties, parishes, villages,
    loadingDistricts, loadingSubcounties, loadingParishes, loadingVillages,
    selectedDistrict, selectedSubcounty, selectedParish, selectedVillage,
    setDistrict, setSubcounty, setParish, setVillage, initValues,
  };
}
