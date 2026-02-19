const registrarCapturaLive = async (precio) => {
    if (!clienteLive.trim() || precio <= 0) return;
    
    // Pregunta rápida por el método de entrega
    const metodo = window.prompt("Método de entrega: 1. Envío | 2. Local | 3. Punto Medio", "1");
    const metodoTxt = metodo === "1" ? "Envío a domicilio" : metodo === "2" ? "Recoge en local" : "Punto medio";

    const folio = `L-${Math.floor(1000 + Math.random() * 9000)}`;
    const nuevaCaptura = {
      id: Date.now(),
      cliente: clienteLive.trim().toUpperCase(),
      precio: Number(precio),
      folio,
      metodo: metodoTxt,
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };

    setCapturasLive([nuevaCaptura, ...capturasLive]);
    
    try {
      await supabase.from('ventas').insert([{ 
        total: nuevaCaptura.precio, 
        costo_total: 0, 
        detalles: `🔴 LIVE [${folio}]: ${nuevaCaptura.cliente} (${metodoTxt})` 
      }]);
      obtenerTodo();
    } catch (e) { console.error("Error guardando en BD", e); }

    setClienteLive('');
    setPrecioLiveManual('');
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const generarWhatsAppLive = (captura) => {
    let msg = `¡Hola *${captura.cliente}*! 👋 Gracias por tu compra en el Live.\n\n`;
    msg += `✅ *Detalle de tu prenda:*\n`;
    msg += `• Folio: *${captura.folio}*\n`;
    msg += `• Precio: *$${captura.precio}*\n`;
    msg += `• Entrega: *${captura.metodo}*\n\n`; // <--- Dato adicional adicionado
    msg += `*Total a pagar: $${captura.precio}*\n\n`;
    msg += `Por favor envíanos tu comprobante y datos de envío por este medio. ¡Tienes 24 hrs! ⏳👗`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
