export const bootstrapPolicy = {
  allowLocalBootstrap: true,
  productionRequiredActionAr: "عند الانتقال للإنتاج يجب تعطيل Bootstrap المحلي وتفعيل Firebase Auth و Custom Claims.",
  reasonAr: "Bootstrap المحلي مخصص للتجربة فقط عند عدم اكتمال Firebase Auth/Claims.",
};

export function localBootstrapWarningAr() {
  return `${bootstrapPolicy.reasonAr} ${bootstrapPolicy.productionRequiredActionAr}`;
}
