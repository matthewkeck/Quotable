// SimplePieChart.jsx

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';


const SimplePieChart = ({data}) => {

  return (
      <div style={{ width: "100%", position: 'relative', margin: '0 1px'}}>
        <ResponsiveContainer width="100%" height={300}>
        <PieChart>
            <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={"45%"}
            outerRadius={"55%"}
            >
            {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            </Pie>
            <Tooltip />
        </PieChart>
        </ResponsiveContainer>
        <div
        style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
        }}
        >
        {data.map((entry, index) => (
            <div key={`legend-${index}`} style={{ color: entry.color, fontSize: 16 }}>
            {entry.name}: {entry.value}
            </div>
        ))}
        </div>
  </div>
  );
};

export default SimplePieChart;
