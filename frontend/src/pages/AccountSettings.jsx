import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

const inputCls =
  "border border-[#ccc] rounded-[3px] px-[6px] py-[4px] text-[13px] bg-white focus:outline-none focus:border-[#b9a070]";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function ls(key, fallback = "") {
  return localStorage.getItem(key) ?? fallback;
}

export default function AccountSettings() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);

  const [firstName,       setFirstName]       = useState(() => ls("profile_firstName", auth.username || ""));
  const [middleName,      setMiddleName]       = useState(() => ls("profile_middleName"));
  const [lastName,        setLastName]         = useState(() => ls("profile_lastName"));
  const [displayOrder,    setDisplayOrder]     = useState(() => ls("profile_displayOrder", "first_last"));
  const [namePrivacy,     setNamePrivacy]      = useState(() => ls("profile_namePrivacy", "anyone"));
  const [profileUrl,      setProfileUrl]       = useState(() => ls("profile_url"));
  const [gender,          setGender]           = useState(() => ls("profile_gender"));
  const [genderViewable,  setGenderViewable]   = useState(() => ls("profile_genderViewable", "Friends Only"));
  const [zip,             setZip]              = useState(() => ls("profile_zip"));
  const [city,            setCity]             = useState(() => ls("profile_city"));
  const [stateCode,       setStateCode]        = useState(() => ls("profile_stateCode"));
  const [country,         setCountry]          = useState(() => ls("profile_country", "India"));
  const [locationViewable,setLocationViewable] = useState(() => ls("profile_locationViewable", "Everyone"));
  const [birthYear,       setBirthYear]        = useState(() => ls("profile_birthYear"));
  const [birthMonth,      setBirthMonth]       = useState(() => ls("profile_birthMonth"));
  const [birthDay,        setBirthDay]         = useState(() => ls("profile_birthDay"));
  const [agePrivacy,      setAgePrivacy]       = useState(() => ls("profile_agePrivacy", "age_members"));
  const [website,         setWebsite]          = useState(() => ls("profile_website"));
  const [interests,       setInterests]        = useState(() => ls("profile_interests"));
  const [bookPrefs,       setBookPrefs]        = useState(() => ls("profile_bookPrefs"));
  const [aboutMe,         setAboutMe]          = useState(() => ls("profile_aboutMe"));
  const [photoPreview,    setPhotoPreview]     = useState(() => ls("profile_photo", null) || null);
  const [fileName,        setFileName]         = useState("No file selected.");

  const displayFirst = [firstName, lastName].filter(Boolean).join(" ") || "First Last";
  const displayLast  = [lastName, firstName].filter(Boolean).join(", ") || "Last, First";

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setPhotoPreview(evt.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleUploadPhoto() {
    if (!photoPreview) return;
    localStorage.setItem("profile_photo", photoPreview);
    setPhotoSaved(true);
    setTimeout(() => setPhotoSaved(false), 2500);
  }

  function handleSave(e) {
    e.preventDefault();
    localStorage.setItem("profile_firstName",        firstName);
    localStorage.setItem("profile_middleName",       middleName);
    localStorage.setItem("profile_lastName",         lastName);
    localStorage.setItem("profile_displayOrder",     displayOrder);
    localStorage.setItem("profile_namePrivacy",      namePrivacy);
    localStorage.setItem("profile_url",              profileUrl);
    localStorage.setItem("profile_gender",           gender);
    localStorage.setItem("profile_genderViewable",   genderViewable);
    localStorage.setItem("profile_zip",              zip);
    localStorage.setItem("profile_city",             city);
    localStorage.setItem("profile_stateCode",        stateCode);
    localStorage.setItem("profile_country",          country);
    localStorage.setItem("profile_locationViewable", locationViewable);
    localStorage.setItem("profile_birthYear",        birthYear);
    localStorage.setItem("profile_birthMonth",       birthMonth);
    localStorage.setItem("profile_birthDay",         birthDay);
    localStorage.setItem("profile_agePrivacy",       agePrivacy);
    localStorage.setItem("profile_website",          website);
    localStorage.setItem("profile_interests",        interests);
    localStorage.setItem("profile_bookPrefs",        bookPrefs);
    localStorage.setItem("profile_aboutMe",          aboutMe);
    if (photoPreview) localStorage.setItem("profile_photo", photoPreview);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleDeleteAccount() {
    if (window.confirm("Are you sure you want to delete your account? This cannot be undone.")) {
      auth.logout();
      navigate("/login");
    }
  }

  return (
    <div
      className="max-w-[960px] mx-auto px-4 pt-6 pb-12"
      style={{ fontFamily: '"Lato", "Helvetica Neue", Helvetica, Arial, sans-serif', color: "#333333" }}
    >
      {/* Page header */}
      <div className="flex justify-between items-baseline border-b border-gray-200 pb-2 mb-6">
        <h1 className="text-2xl font-serif text-[#333333]">Account Settings</h1>
        <Link to="/profile" className="text-xs text-[#00635d] hover:underline">
          View My Profile
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">

        {/* ── Main form ── */}
        <form className="md:col-span-3 space-y-6" onSubmit={handleSave}>

          {saved && (
            <div className="bg-green-50 border border-green-300 text-green-800 text-sm rounded px-3 py-2">
              Profile settings saved successfully.
            </div>
          )}

          {/* ── Display name ── */}
          <div>
            <h2 className="text-base font-bold text-[#333333] mb-1">Display name</h2>
            <p className="text-xs text-gray-500 mb-3">Manage how your name appears on Goodreads</p>

            <div className="space-y-3 max-w-sm">
              <div>
                <label className="block mb-1 text-[13px]">
                  First Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div>
                <label className="block mb-1 text-[13px]">Middle Name</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div>
                <label className="block mb-1 text-[13px]">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div>
                <label className="block mb-1 text-[13px]">Display name order</label>
                <select
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className={`w-full ${inputCls}`}
                >
                  <option value="first_last">{displayFirst}</option>
                  <option value="last_first">{displayLast}</option>
                </select>
              </div>

              <div>
                <span className="block text-xs mb-1">Show my last name to:</span>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="name_privacy"
                      checked={namePrivacy === "anyone"}
                      onChange={() => setNamePrivacy("anyone")}
                    />
                    <span>
                      Anyone (including search engines){" "}
                      <span className="text-[#00635d]">[?]</span>
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="name_privacy"
                      checked={namePrivacy === "none"}
                      onChange={() => setNamePrivacy("none")}
                    />
                    <span>No One</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* ── Profile information ── */}
          <div>
            <h2 className="text-base font-bold text-[#333333] mb-1">Profile information</h2>
            <p className="text-xs text-gray-500 mb-4">
              Manage what people see when they view your profile.
            </p>

            <div className="space-y-4">

              <div className="max-w-sm">
                <label className="block mb-1 text-[13px]">
                  Profile URL{" "}
                  <span className="text-gray-400 font-normal">(goodreads.com/your_name)</span>
                </label>
                <input
                  type="text"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div className="max-w-xs">
                <label className="block mb-1 text-[13px]">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={`w-full ${inputCls}`}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="max-w-xs">
                <label className="block mb-1 text-[13px]">Gender Viewable By</label>
                <select
                  value={genderViewable}
                  onChange={(e) => setGenderViewable(e.target.value)}
                  className={`w-full ${inputCls}`}
                >
                  <option>Friends Only</option>
                  <option>Everyone</option>
                </select>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  Note: Pronouns (he/she/they) will be seen by everyone regardless of this setting.
                </span>
              </div>

              <div className="max-w-[120px]">
                <label className="block mb-1 text-[13px]">
                  ZIP Code <span className="text-gray-400 font-normal">(US only)</span>
                </label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div className="max-w-xs">
                <label className="block mb-1 text-[13px]">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div className="max-w-[120px]">
                <label className="block mb-1 text-[13px]">State/Province Code</label>
                <input
                  type="text"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div className="max-w-xs">
                <label className="block mb-1 text-[13px]">Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={`w-full ${inputCls}`}
                >
                  <option>India</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Canada</option>
                  <option>Australia</option>
                  <option>Germany</option>
                  <option>France</option>
                  <option>Japan</option>
                </select>
              </div>

              <div className="max-w-xs">
                <label className="block mb-1 text-[13px]">Location Viewable By</label>
                <select
                  value={locationViewable}
                  onChange={(e) => setLocationViewable(e.target.value)}
                  className={`w-full ${inputCls}`}
                >
                  <option>Everyone</option>
                  <option>Friends Only</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[13px]">Date of Birth</label>
                <div className="flex space-x-2">
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Year:</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Month:</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Day:</option>
                    {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="max-w-xs">
                <label className="block mb-1 text-[13px]">Age &amp; Birthday Privacy:</label>
                <select
                  value={agePrivacy}
                  onChange={(e) => setAgePrivacy(e.target.value)}
                  className={`w-full ${inputCls}`}
                >
                  <option value="age_members">
                    Age to Goodreads members, Birthday to friends
                  </option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[13px]">
                  My Web Site{" "}
                  <span className="text-gray-400 font-normal">(e.g. http://www.myblog.com)</span>
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={`w-full max-w-xl ${inputCls}`}
                />
              </div>

              <div>
                <label className="block mb-1 text-[13px]">
                  My Interests —{" "}
                  <span className="text-gray-500 font-normal text-xs">
                    favorite subjects, or really anything you know a lot about (comma separated please)
                  </span>
                </label>
                <input
                  type="text"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  className={`w-full max-w-xl ${inputCls}`}
                />
              </div>

              <div>
                <label className="block mb-1 text-[13px]">
                  What Kind of Books Do You Like to Read?
                </label>
                <input
                  type="text"
                  value={bookPrefs}
                  onChange={(e) => setBookPrefs(e.target.value)}
                  className={`w-full max-w-xl ${inputCls}`}
                />
              </div>

              <div>
                <label className="block mb-1 text-[13px]">
                  About Me{" "}
                  <span className="text-cyan-600 text-xs">[Tips]</span>
                </label>
                <span className="text-[11px] text-gray-400 block mb-1">
                  Adding URLs to your About Me section is disabled.
                </span>
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  className={`w-full max-w-xl h-44 resize-y ${inputCls}`}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 pb-12">
            <button
              type="submit"
              className="bg-[#f4f1ea] border border-[#d6d0c4] text-[#333333] rounded px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-[#e8e3d7] cursor-pointer"
            >
              Save Profile Settings
            </button>
          </div>
        </form>

        {/* ── Sidebar: photo upload + delete ── */}
        <div className="md:col-span-1 flex flex-col items-center md:items-start text-center md:text-left pt-6">
          <div className="w-28 h-36 bg-[#f2f2ed] border border-gray-300 flex items-center justify-center mb-2 shadow-inner overflow-hidden">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Profile"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <svg className="w-20 h-24 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5-4-8-4z" />
              </svg>
            )}
          </div>

          <div className="space-y-2 w-full text-center md:text-left">
            <input
              type="file"
              id="file-upload"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div>
              <label
                htmlFor="file-upload"
                className="bg-gray-100 border border-gray-400 text-gray-700 px-2 py-0.5 rounded text-[11px] cursor-pointer hover:bg-gray-200"
              >
                Choose File
              </label>
              <span className="text-gray-500 ml-1 text-[11px]">{fileName}</span>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleUploadPhoto}
                className="bg-[#f4f1ea] border border-[#d6d0c4] text-xs px-2 py-0.5 rounded shadow-sm text-gray-700 hover:bg-[#e8e3d7] cursor-pointer"
              >
                Upload Photo
              </button>
              {photoSaved && (
                <span className="text-[11px] text-green-700 ml-2">Photo saved!</span>
              )}
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="text-[11px] text-red-700 hover:underline"
              >
                Delete my account
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
