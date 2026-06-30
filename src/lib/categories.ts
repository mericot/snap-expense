export const CATEGORIES = ['Software', 'Travel', 'Meals', 'Office', 'Hardware', 'Other'] as const

export type Category = typeof CATEGORIES[number]
