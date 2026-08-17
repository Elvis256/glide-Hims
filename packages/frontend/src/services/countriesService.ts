import { COUNTRIES_FALLBACK, type Country } from '../data/countries';

/**
 * The country list for patient registration.
 *
 * This used to fetch restcountries.com on the way in, with the bundled list
 * only as a fallback. On a hospital network that is the wrong way round. The
 * call is on the patient-registration path, so with no internet — which is the
 * normal state of most of the sites this runs on — every registration waited
 * out a five second timeout before showing the same list it already had, and
 * left a CORS failure in the console each time.
 *
 * The bundled list carries 72 countries with Uganda and its neighbours first,
 * which is the whole realistic need here. Nothing about a patient's country of
 * origin needs to come from a third party mid-consultation.
 *
 * Still async: the callers await it, and keeping the signature means this can
 * go back to a server-side source later without touching them.
 */
export async function fetchAllCountries(): Promise<Country[]> {
  return [...COUNTRIES_FALLBACK].sort((a, b) => {
    if (a.code === 'UG') return -1;
    if (b.code === 'UG') return 1;
    return a.name.localeCompare(b.name);
  });
}
