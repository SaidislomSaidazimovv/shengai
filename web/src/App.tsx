import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Landing } from "@/pages/Landing";
import { FreeTest } from "@/pages/FreeTest";
import { Practice } from "@/pages/Practice";
import { PinyinChartPage } from "@/pages/PinyinChartPage";
import { Dashboard } from "@/pages/Dashboard";
import { Lesson } from "@/pages/Lesson";
import { NotFound } from "@/pages/NotFound";
import { useAuth } from "@/hooks/useAuth";
import { attachRemoteSync } from "@/store/userStore";

export default function App() {
  const { user, enabled } = useAuth();

  useEffect(() => {
    if (!enabled) return;
    void attachRemoteSync(user?.uid ?? null);
  }, [user, enabled]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="/test" element={<FreeTest />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/pinyin" element={<PinyinChartPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lesson/:id" element={<Lesson />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
