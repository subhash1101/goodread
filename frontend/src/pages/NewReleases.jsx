import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function NewReleases() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/browse?mode=new", { replace: true }); }, []);
  return null;
}
