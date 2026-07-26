import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabaseClient.js";

export default function TrendChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("exposure_snapshots")
      .select("*")
      .order("captured_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setData((data || []).map(d => ({
          date: new Date(d.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          avgScore: Number(d.avg_score),
          critical: d.critical_count,
        })));
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, padding: 16 }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B6B7C", marginBottom: 12 }}>
        Exposure trend
      </div>
      {loading ? (
        <div style={{ color: "#5B6B7C", fontSize: 13 }}>Loading trend...</div>
      ) : data.length < 2 ? (
        <div style={{ color: "#5B6B7C", fontSize: 13 }}>
          Not enough history yet — this chart fills in automatically as risks are created and edited over time.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#E5E8EA" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#5B6B7C", fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#C9D1D6" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#5B6B7C", fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, border: "1px solid #C9D1D6", borderRadius: 4 }} />
            <Line type="monotone" dataKey="avgScore" name="Avg. exposure score" stroke="#16233A" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="critical" name="Critical risks" stroke="#8E2E2E" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
