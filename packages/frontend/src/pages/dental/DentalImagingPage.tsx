import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Search,
  X,
  Upload,
  Trash2,
  Image as ImageIcon,
  FileText,
  Columns,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

interface DentalImage {
  id: string;
  imageType: string;
  toothNumber: number | null;
  filePath: string;
  fileName: string;
  notes: string;
  createdAt: string;
}

const IMAGE_TYPES = [
  'periapical',
  'bitewing',
  'panoramic',
  'cephalometric',
  'cbct',
  'intraoral_photo',
];

const TEETH = Array.from({ length: 32 }, (_, i) => i + 1);

export default function DentalImagingPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterTooth, setFilterTooth] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedImage, setSelectedImage] = useState<DentalImage | null>(null);
  const [compareImages, setCompareImages] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Upload form
  const [uploadType, setUploadType] = useState('periapical');
  const [uploadTooth, setUploadTooth] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Patient search
  const { data: searchResults, isLoading: searching } = useQuery<Patient[]>({
    queryKey: ['patient-search', patientSearch, facilityId],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const res = await api.get('/patients/search', { params: { query: patientSearch } });
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
    enabled: patientSearch.length >= 2 && !selectedPatient,
  });

  // Images
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['dental-images', selectedPatient?.id, filterType, filterTooth, facilityId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterType) params.imageType = filterType;
      if (filterTooth) params.toothNumber = filterTooth;
      const res = await api.get(`/dental/images/patient/${selectedPatient!.id}`, { params });
      return res.data;
    },
    enabled: !!selectedPatient,
  });

  const images = asList<DentalImage>(imagesData);

  // Upload
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/dental/images', {
        patientId: selectedPatient!.id,
        imageType: uploadType,
        toothNumber: uploadTooth ? Number(uploadTooth) : null,
        fileName: uploadFile?.name ?? 'unnamed',
        filePath: uploadFile?.name ?? 'unnamed',
        notes: uploadNotes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Image record created');
      queryClient.invalidateQueries({ queryKey: ['dental-images', selectedPatient?.id] });
      resetUpload();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/dental/images/${id}`);
    },
    onSuccess: () => {
      toast.success('Image deleted');
      queryClient.invalidateQueries({ queryKey: ['dental-images', selectedPatient?.id] });
      setDeleteConfirm(null);
      setSelectedImage(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const resetUpload = () => {
    setShowUpload(false);
    setUploadType('periapical');
    setUploadTooth('');
    setUploadNotes('');
    setUploadFile(null);
  };

  const toggleCompare = (id: string) => {
    setCompareImages((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev,
    );
  };

  const compareSelected = images.filter((img) => compareImages.includes(img.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dental Imaging</h1>
        <div className="flex gap-2">
          {compareImages.length === 2 && (
            <button
              onClick={() => setShowCompare(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Columns className="h-4 w-4" />
              Compare ({compareImages.length})
            </button>
          )}
          {selectedPatient && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              Upload Image
            </button>
          )}
        </div>
      </div>

      {/* Patient Selector */}
      <div className="relative max-w-md">
        {selectedPatient ? (
          <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2">
            <span className="font-medium">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </span>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setPatientSearch('');
                setCompareImages([]);
              }}
              className="ml-auto rounded p-1 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full rounded-lg border bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
            {searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatient(p);
                      setPatientSearch('');
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {p.firstName} {p.lastName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      {selectedPatient && (
        <div className="flex gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {IMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={filterTooth}
            onChange={(e) => setFilterTooth(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="">All Teeth</option>
            {TEETH.map((t) => (
              <option key={t} value={t}>
                Tooth {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Image Gallery */}
      {selectedPatient && (
        <>
          {imagesLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : images.length === 0 ? (
            <div className="rounded-xl border bg-white py-16 text-center text-gray-500">
              <ImageIcon className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p>No images found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`group relative rounded-xl border bg-white p-3 transition-shadow hover:shadow-md ${
                    compareImages.includes(img.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {/* Checkbox for compare */}
                  <div className="absolute right-2 top-2 z-10">
                    <input
                      type="checkbox"
                      checked={compareImages.includes(img.id)}
                      onChange={() => toggleCompare(img.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>

                  {/* Thumbnail / icon */}
                  <button
                    onClick={() => setSelectedImage(img)}
                    className="flex h-32 w-full items-center justify-center rounded-lg bg-gray-100"
                  >
                    {img.filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <ImageIcon className="h-12 w-12 text-gray-400" />
                    ) : (
                      <FileText className="h-12 w-12 text-gray-400" />
                    )}
                  </button>

                  <div className="mt-2">
                    <p className="truncate text-sm font-medium">{img.fileName}</p>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {img.imageType.replace(/_/g, ' ')}
                      </span>
                      {img.toothNumber && (
                        <span className="text-xs text-gray-400">Tooth {img.toothNumber}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(img.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!selectedPatient && (
        <div className="rounded-xl border bg-white py-16 text-center text-gray-500">
          <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-medium">Select a Patient</p>
          <p className="text-sm">Search for a patient to manage dental images</p>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Upload Image</h3>
              <button onClick={resetUpload} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Image Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {IMAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tooth Number (optional)</label>
                <select
                  value={uploadTooth}
                  onChange={(e) => setUploadTooth(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {TEETH.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">File</label>
                <input
                  type="file"
                  accept="image/*,.dcm"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={resetUpload}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !uploadFile}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedImage.fileName}</h3>
              <button onClick={() => setSelectedImage(null)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 flex h-64 items-center justify-center rounded-lg bg-gray-100">
              <Eye className="h-16 w-16 text-gray-300" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>{' '}
                <span className="font-medium">{selectedImage.imageType.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-gray-500">Tooth:</span>{' '}
                <span className="font-medium">{selectedImage.toothNumber ?? 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>{' '}
                <span className="font-medium">{new Date(selectedImage.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">File:</span>{' '}
                <span className="font-medium">{selectedImage.fileName}</span>
              </div>
              {selectedImage.notes && (
                <div className="col-span-2">
                  <span className="text-gray-500">Notes:</span>{' '}
                  <span>{selectedImage.notes}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {deleteConfirm === selectedImage.id ? (
                <>
                  <span className="self-center text-sm text-red-600">Are you sure?</span>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(selectedImage.id)}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(selectedImage.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && compareSelected.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Compare Images</h3>
              <button
                onClick={() => {
                  setShowCompare(false);
                  setCompareImages([]);
                }}
                className="rounded p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {compareSelected.map((img) => (
                <div key={img.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex h-48 items-center justify-center rounded-lg bg-gray-100">
                    <Eye className="h-12 w-12 text-gray-300" />
                  </div>
                  <p className="font-medium">{img.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {img.imageType.replace(/_/g, ' ')} · {new Date(img.createdAt).toLocaleDateString()}
                    {img.toothNumber && ` · Tooth ${img.toothNumber}`}
                  </p>
                  {img.notes && <p className="mt-1 text-xs text-gray-400">{img.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
