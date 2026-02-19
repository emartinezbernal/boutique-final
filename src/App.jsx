import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  // --- ESTADOS ---
  const [inventario, setInventario] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [arqueos, setArqueos] = useState([]);
  
  // Fecha local para consultas
  const hoyStr = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  }, []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);

  // Inputs
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoGasto, setNuevoGasto] = useState({ descripcion: '', monto: '' });
  const [efectivoCaja, setEfectivoCaja] = useState('');
  
  const inputNombreRef = useRef(null);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    obtenerTodo();
  }, []);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
    const { data: a } = await supabase.from('arqueos').select('*').order('created_at', { ascending: false });
    if (a) setArqueos(a);
  }

  // --- LÓGICA DE VENTAS ---
  async function registrarVenta() {
    const totalVenta = carrito.reduce((a, b) => a + Number(b.precio), 0);
    const costoTotal = carrito.reduce((a, b) => a + (Number(b.costo_unitario) || 0), 0);
    const detalle = carrito.map(p => `${p.nombre} (${p.proveedor || 'S/P'})`).join(', ');

    const { error } = await supabase.from('ventas').insert([
      { productos: detalle, total: totalVenta, costo_total: costoTotal, vendedor: 'Vendedor' }
    ]);

    if (!error) {
      for (const item of carrito) {
        await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      setCarrito([]);
      obtenerTodo();
      setVista('catalogo');
      alert("✅ Venta registrada con éxito");
    }
  }

  // --- CÁLCULOS ESTADÍSTICOS ---
  const stats = useMemo(() => {
    const fLocal = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    
    const vntDia = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fLocal);
    const gstDia = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === fLocal);
    
    const ingresos = vntDia.reduce((a, b) => a + b.total, 0);
    const egresos = gstDia.reduce((a, b) => a + b.monto, 0);
    const costos = vntDia.reduce((a, b) => a + (b.costo_total || 0), 0);
    
    return {
      ingresos,
      egresos,
      utilidadBruta: ingresos - costos,
      netoEfectivo: ingresos - egresos,
      vntDia,
      gstDia
    };
  }, [historial, gastos, fechaConsulta]);

  const invPorProveedor = useMemo(() => {
    const resumen = {};
    inventario.forEach(p => {
      const prov = p.proveedor || 'Sin Proveedor';
      if (!resumen[prov]) resumen[prov] = { stock: 0, inversion: 0, ventaEst: 0 };
      resumen[prov].stock += p.stock;
      resumen[prov].inversion += (p.stock * (p.costo_unitario || 0));
      resumen[prov].ventaEst += (p.stock * p.precio);
    });
    return resumen;
  }, [inventario]);

  // --- ESTILOS ---
  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '15px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '10px', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' },
    th: { background: '#f8fafc', color: '#64748b', padding: '10px', fontSize: '11px', textAlign: 'left', borderBottom: '1px solid #eee'
