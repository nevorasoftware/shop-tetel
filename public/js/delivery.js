/**
 * Módulo de Geografía y Envíos de El Salvador
 * Gestiona los 14 Departamentos y Distritos/Municipios
 */
export class DeliveryService {
  constructor() {
    this.departments = [];
    this.selectedDepartment = null;
    this.selectedMunicipality = null;
    this.selectedDistrict = null;
  }

  async loadDepartments() {
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      if (data.success) {
        this.departments = data.data;
        return this.departments;
      }
    } catch (error) {
      console.error('Error cargando departamentos de El Salvador:', error);
    }
    return [];
  }

  getDepartment(departmentIdOrName) {
    if (!departmentIdOrName) return null;
    const term = departmentIdOrName.toLowerCase();
    return this.departments.find(
      d => d.id.toLowerCase() === term || d.name.toLowerCase() === term
    );
  }

  calculateShipping(departmentName, subtotal = 0) {
    const dept = this.getDepartment(departmentName);
    if (!dept) {
      return { cost: 4.00, time: '24 - 48 horas', isFree: false };
    }

    const isFree = subtotal >= dept.freeShippingThreshold;
    const cost = isFree ? 0.00 : dept.shippingCost;

    return {
      cost,
      time: dept.deliveryTime,
      isFree,
      threshold: dept.freeShippingThreshold,
      zone: dept.zone
    };
  }

  populateDepartmentSelect(selectElement, defaultVal = '') {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecciona Departamento --</option>';
    for (const d of this.departments) {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = `${d.name} (${d.zone}) - $${d.shippingCost.toFixed(2)}`;
      if (d.name === defaultVal || d.id === defaultVal) {
        opt.selected = true;
      }
      selectElement.appendChild(opt);
    }
  }

  populateDistrictSelect(districtSelectElement, departmentName, defaultDistrict = '') {
    if (!districtSelectElement) return;
    const dept = this.getDepartment(departmentName);
    if (!dept) {
      districtSelectElement.innerHTML = '<option value="">Primero elige un departamento</option>';
      districtSelectElement.disabled = true;
      return;
    }

    districtSelectElement.disabled = false;
    districtSelectElement.innerHTML = '<option value="">-- Selecciona Municipio / Distrito --</option>';

    for (const muni of dept.municipalities) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = muni.name;

      for (const dist of muni.districts) {
        const opt = document.createElement('option');
        opt.value = dist;
        opt.textContent = dist;
        opt.dataset.municipality = muni.name;
        if (dist === defaultDistrict) {
          opt.selected = true;
        }
        optGroup.appendChild(opt);
      }
      districtSelectElement.appendChild(optGroup);
    }
  }
}

export const deliveryService = new DeliveryService();
