import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import styles from './ChatWindow.module.css';

const COLORS = ['#22B8CF', '#7C6FF0', '#2E9E6B', '#F59E0B', '#E8534F', '#EC4899'];

export default function ChartRenderer({ jsonString }) {
  let chartData;
  try {
    chartData = JSON.parse(jsonString);
  } catch (e) {
    return <div className={styles.chartError}>Failed to parse chart data.</div>;
  }

  const { type, data, xKey, yKey, nameKey, valueKey } = chartData;

  if (!data || !Array.isArray(data)) {
    return <div className={styles.chartError}>Invalid chart data format.</div>;
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey={xKey || 'name'} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface)', 
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  borderRadius: 8
                }} 
              />
              <Legend />
              <Bar dataKey={yKey || 'value'} fill="#22B8CF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey={xKey || 'name'} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface)', 
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  borderRadius: 8
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey={yKey || 'value'} stroke="#22B8CF" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey={valueKey || 'value'}
                nameKey={nameKey || 'name'}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return <div className={styles.chartError}>Unsupported chart type: {type}</div>;
    }
  };

  return (
    <div className={styles.chartContainer}>
      {renderChart()}
    </div>
  );
}
