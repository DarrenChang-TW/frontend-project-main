module.exports = {
    mode: 'jit',
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    100: 'rgb(96, 158, 128)', //#609E80
                    85: 'rgba(96, 158, 128, 0.85)',
                    10: 'rgba(96, 158, 128, 0.10)',
                    background: '#f0f0f0'
                },
                secondary: {
                    100: 'rgb(255, 111, 42)',
                    85: 'rgba(255, 111, 42, 0.85)',
                    10: 'rgba(255, 111, 42, 0.10)'
                },
                black: {
                    text: 'rgb(51, 51, 51)',
                    white: 'rgb(255, 255, 255)',
                    background: 'rgb(240, 240, 240)', //#f0f0f0
                    light_background: 'rgba(51,51,51,0.05)',
                    disable: 'rgba(0, 0, 0, 0.15)',
                    gray_text: 'rgb(135, 148, 151)', //#879497
                    border: 'rgb(215, 215, 215)', //#d7d7d7
                    border10: 'rgba(215, 215, 215, 0.1)',
                    border20: 'rgba(215, 215, 215, 0.2)'
                },
                assistive: {
                    ced4da: 'rgba(206, 212, 218)',
                    ced4da30: 'rgba(206, 212, 218, 0.3)',
                    check: 'rgb(0, 208, 31)'
                },
                warning: {
                    100: 'rgb(255, 42, 42)',
                    10: 'rgba(255, 42, 42, 0.1)'
                },
                greyBlue: '#5dc5d9',
                maize: '#fabe56'

            },
            letterSpacing: {
                tight: '1px',
                normal: '1.2px'
            },
            boxShadow: {
                down: '0 1px 0 0 rgba(0, 0, 0, 0.1)',
                right: '1px 0 0 0 rgba(0, 0, 0, 0.1)',
                panel: '0 2px 10px 0 rgba(51, 51, 51, 0.05);'
            }
        },
    },
    plugins: [{
        'postcss-import': {},
    }]
}
