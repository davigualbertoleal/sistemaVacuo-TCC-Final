namespace sistemaVacuo
{
    partial class Form1
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Código gerado pelo Windows Form Designer

        private void InitializeComponent()
        {
            System.Windows.Forms.DataVisualization.Charting.ChartArea chartArea2 = new System.Windows.Forms.DataVisualization.Charting.ChartArea();
            System.Windows.Forms.DataVisualization.Charting.Legend legend2 = new System.Windows.Forms.DataVisualization.Charting.Legend();
            System.Windows.Forms.DataVisualization.Charting.Series series2 = new System.Windows.Forms.DataVisualization.Charting.Series();
            this.panel4 = new System.Windows.Forms.Panel();
            this.label8 = new System.Windows.Forms.Label();
            this.label2 = new System.Windows.Forms.Label();
            this.label1 = new System.Windows.Forms.Label();
            this.panel5 = new System.Windows.Forms.Panel();
            this.label7 = new System.Windows.Forms.Label();
            this.label6 = new System.Windows.Forms.Label();
            this.label5 = new System.Windows.Forms.Label();
            this.lblTempoAtuacao = new System.Windows.Forms.Label();
            this.lblTempOleo = new System.Windows.Forms.Label();
            this.lblPressao = new System.Windows.Forms.Label();
            this.panel6 = new System.Windows.Forms.Panel();
            this.lblValvula = new System.Windows.Forms.Label();
            this.lblAquecedorStatus = new System.Windows.Forms.Label();
            this.lblAquecedor = new System.Windows.Forms.Label();
            this.lblBomba1Status = new System.Windows.Forms.Label();
            this.lblBomba1 = new System.Windows.Forms.Label();
            this.lblBombaBoosterStatus = new System.Windows.Forms.Label();
            this.lblBombaBooster = new System.Windows.Forms.Label();
            this.lblBombaPrelStatus = new System.Windows.Forms.Label();
            this.lblBombaPrel = new System.Windows.Forms.Label();
            this.panel7 = new System.Windows.Forms.Panel();
            this.lblMeta = new System.Windows.Forms.Label();
            this.chart1 = new System.Windows.Forms.DataVisualization.Charting.Chart();
            this.label4 = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.label9 = new System.Windows.Forms.Label();
            this.label10 = new System.Windows.Forms.Label();
            this.panel4.SuspendLayout();
            this.panel5.SuspendLayout();
            this.panel6.SuspendLayout();
            this.panel7.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.chart1)).BeginInit();
            this.SuspendLayout();
            // 
            // panel4
            // 
            this.panel4.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(20)))), ((int)(((byte)(20)))), ((int)(((byte)(20)))));
            this.panel4.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel4.Controls.Add(this.label8);
            this.panel4.Controls.Add(this.label2);
            this.panel4.Location = new System.Drawing.Point(27, 31);
            this.panel4.Name = "panel4";
            this.panel4.Size = new System.Drawing.Size(911, 92);
            this.panel4.TabIndex = 3;
            // 
            // label8
            // 
            this.label8.AutoSize = true;
            this.label8.Font = new System.Drawing.Font("Nirmala UI", 20.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label8.ForeColor = System.Drawing.Color.Red;
            this.label8.Location = new System.Drawing.Point(839, 26);
            this.label8.Name = "label8";
            this.label8.Size = new System.Drawing.Size(35, 37);
            this.label8.TabIndex = 1;
            this.label8.Text = "X";
            this.label8.Click += new System.EventHandler(this.label8_Click);
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Font = new System.Drawing.Font("Tahoma", 20.25F, System.Drawing.FontStyle.Bold);
            this.label2.ForeColor = System.Drawing.SystemColors.ControlLightLight;
            this.label2.Location = new System.Drawing.Point(19, 30);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(262, 33);
            this.label2.TabIndex = 0;
            this.label2.Text = "Controle de Vácuo";
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("Tahoma", 10.25F, System.Drawing.FontStyle.Bold);
            this.label1.ForeColor = System.Drawing.Color.FromArgb(((int)(((byte)(90)))), ((int)(((byte)(90)))), ((int)(((byte)(90)))));
            this.label1.Location = new System.Drawing.Point(672, 11);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(266, 17);
            this.label1.TabIndex = 4;
            this.label1.Text = "TSEA Energy | 22/03/26 | 23:48:49";
            this.label1.Click += new System.EventHandler(this.label1_Click_1);
            // 
            // panel5
            // 
            this.panel5.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(20)))), ((int)(((byte)(20)))), ((int)(((byte)(20)))));
            this.panel5.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel5.Controls.Add(this.label7);
            this.panel5.Controls.Add(this.label6);
            this.panel5.Controls.Add(this.label5);
            this.panel5.Controls.Add(this.lblTempoAtuacao);
            this.panel5.Controls.Add(this.lblTempOleo);
            this.panel5.Controls.Add(this.lblPressao);
            this.panel5.Location = new System.Drawing.Point(751, 138);
            this.panel5.Name = "panel5";
            this.panel5.Size = new System.Drawing.Size(187, 355);
            this.panel5.TabIndex = 1;
            this.panel5.Paint += new System.Windows.Forms.PaintEventHandler(this.panel5_Paint);
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Font = new System.Drawing.Font("Tahoma", 20.25F, System.Drawing.FontStyle.Bold);
            this.label7.ForeColor = System.Drawing.SystemColors.ControlLightLight;
            this.label7.Location = new System.Drawing.Point(41, 238);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(98, 33);
            this.label7.TabIndex = 7;
            this.label7.Text = "94Min";
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Font = new System.Drawing.Font("Tahoma", 20.25F, System.Drawing.FontStyle.Bold);
            this.label6.ForeColor = System.Drawing.SystemColors.ControlLightLight;
            this.label6.Location = new System.Drawing.Point(17, 111);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(165, 33);
            this.label6.TabIndex = 6;
            this.label6.Text = "65.0 MBarr";
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Font = new System.Drawing.Font("Tahoma", 20.25F, System.Drawing.FontStyle.Bold);
            this.label5.ForeColor = System.Drawing.SystemColors.ControlLightLight;
            this.label5.Location = new System.Drawing.Point(15, 38);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(165, 33);
            this.label5.TabIndex = 4;
            this.label5.Text = "65.0 MBarr";
            // 
            // lblTempoAtuacao
            // 
            this.lblTempoAtuacao.AutoSize = true;
            this.lblTempoAtuacao.Font = new System.Drawing.Font("Segoe UI", 9.75F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblTempoAtuacao.ForeColor = System.Drawing.Color.DarkGray;
            this.lblTempoAtuacao.Location = new System.Drawing.Point(32, 185);
            this.lblTempoAtuacao.Name = "lblTempoAtuacao";
            this.lblTempoAtuacao.Size = new System.Drawing.Size(118, 17);
            this.lblTempoAtuacao.TabIndex = 4;
            this.lblTempoAtuacao.Text = "Tempo de Atuação";
            this.lblTempoAtuacao.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            this.lblTempoAtuacao.Click += new System.EventHandler(this.lblTempoAtuacao_Click);
            // 
            // lblTempOleo
            // 
            this.lblTempOleo.AutoSize = true;
            this.lblTempOleo.Font = new System.Drawing.Font("Segoe UI", 9.75F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblTempOleo.ForeColor = System.Drawing.Color.DarkGray;
            this.lblTempOleo.Location = new System.Drawing.Point(21, 87);
            this.lblTempOleo.Name = "lblTempOleo";
            this.lblTempOleo.Size = new System.Drawing.Size(94, 17);
            this.lblTempOleo.TabIndex = 2;
            this.lblTempOleo.Text = "Temp. de Óleo";
            // 
            // lblPressao
            // 
            this.lblPressao.AutoSize = true;
            this.lblPressao.Font = new System.Drawing.Font("Segoe UI", 9.75F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblPressao.ForeColor = System.Drawing.Color.DarkGray;
            this.lblPressao.Location = new System.Drawing.Point(21, 19);
            this.lblPressao.Name = "lblPressao";
            this.lblPressao.Size = new System.Drawing.Size(54, 17);
            this.lblPressao.TabIndex = 0;
            this.lblPressao.Text = "Pressão";
            // 
            // panel6
            // 
            this.panel6.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(20)))), ((int)(((byte)(20)))), ((int)(((byte)(20)))));
            this.panel6.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel6.Controls.Add(this.label10);
            this.panel6.Controls.Add(this.label9);
            this.panel6.Controls.Add(this.lblValvula);
            this.panel6.Controls.Add(this.lblAquecedorStatus);
            this.panel6.Controls.Add(this.lblAquecedor);
            this.panel6.Controls.Add(this.lblBomba1Status);
            this.panel6.Controls.Add(this.lblBomba1);
            this.panel6.Controls.Add(this.lblBombaBoosterStatus);
            this.panel6.Controls.Add(this.lblBombaBooster);
            this.panel6.Controls.Add(this.lblBombaPrelStatus);
            this.panel6.Controls.Add(this.lblBombaPrel);
            this.panel6.Location = new System.Drawing.Point(27, 138);
            this.panel6.Name = "panel6";
            this.panel6.Size = new System.Drawing.Size(187, 355);
            this.panel6.TabIndex = 2;
            // 
            // lblValvula
            // 
            this.lblValvula.AutoSize = true;
            this.lblValvula.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblValvula.ForeColor = System.Drawing.Color.DarkGray;
            this.lblValvula.Location = new System.Drawing.Point(17, 267);
            this.lblValvula.Name = "lblValvula";
            this.lblValvula.Size = new System.Drawing.Size(100, 15);
            this.lblValvula.TabIndex = 8;
            this.lblValvula.Text = "Válvula 1: ABERTA";
            this.lblValvula.Click += new System.EventHandler(this.lblValvula_Click);
            // 
            // lblAquecedorStatus
            // 
            this.lblAquecedorStatus.AutoSize = true;
            this.lblAquecedorStatus.Font = new System.Drawing.Font("Segoe UI", 14.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblAquecedorStatus.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblAquecedorStatus.Location = new System.Drawing.Point(18, 222);
            this.lblAquecedorStatus.Name = "lblAquecedorStatus";
            this.lblAquecedorStatus.Size = new System.Drawing.Size(41, 25);
            this.lblAquecedorStatus.TabIndex = 7;
            this.lblAquecedorStatus.Text = "ON";
            // 
            // lblAquecedor
            // 
            this.lblAquecedor.AutoSize = true;
            this.lblAquecedor.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblAquecedor.ForeColor = System.Drawing.Color.DarkGray;
            this.lblAquecedor.Location = new System.Drawing.Point(20, 203);
            this.lblAquecedor.Name = "lblAquecedor";
            this.lblAquecedor.Size = new System.Drawing.Size(65, 15);
            this.lblAquecedor.TabIndex = 6;
            this.lblAquecedor.Text = "Aquecedor";
            // 
            // lblBomba1Status
            // 
            this.lblBomba1Status.AutoSize = true;
            this.lblBomba1Status.Font = new System.Drawing.Font("Segoe UI", 14.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblBomba1Status.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblBomba1Status.Location = new System.Drawing.Point(18, 158);
            this.lblBomba1Status.Name = "lblBomba1Status";
            this.lblBomba1Status.Size = new System.Drawing.Size(41, 25);
            this.lblBomba1Status.TabIndex = 5;
            this.lblBomba1Status.Text = "ON";
            // 
            // lblBomba1
            // 
            this.lblBomba1.AutoSize = true;
            this.lblBomba1.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblBomba1.ForeColor = System.Drawing.Color.DarkGray;
            this.lblBomba1.Location = new System.Drawing.Point(20, 139);
            this.lblBomba1.Name = "lblBomba1";
            this.lblBomba1.Size = new System.Drawing.Size(54, 15);
            this.lblBomba1.TabIndex = 4;
            this.lblBomba1.Text = "Bomba 1";
            // 
            // lblBombaBoosterStatus
            // 
            this.lblBombaBoosterStatus.AutoSize = true;
            this.lblBombaBoosterStatus.Font = new System.Drawing.Font("Segoe UI", 14.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblBombaBoosterStatus.ForeColor = System.Drawing.Color.Gold;
            this.lblBombaBoosterStatus.Location = new System.Drawing.Point(16, 99);
            this.lblBombaBoosterStatus.Name = "lblBombaBoosterStatus";
            this.lblBombaBoosterStatus.Size = new System.Drawing.Size(63, 25);
            this.lblBombaBoosterStatus.TabIndex = 3;
            this.lblBombaBoosterStatus.Text = "AUTO";
            // 
            // lblBombaBooster
            // 
            this.lblBombaBooster.AutoSize = true;
            this.lblBombaBooster.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblBombaBooster.ForeColor = System.Drawing.Color.DarkGray;
            this.lblBombaBooster.Location = new System.Drawing.Point(20, 74);
            this.lblBombaBooster.Name = "lblBombaBooster";
            this.lblBombaBooster.Size = new System.Drawing.Size(88, 15);
            this.lblBombaBooster.TabIndex = 2;
            this.lblBombaBooster.Text = "Bomba Booster";
            // 
            // lblBombaPrelStatus
            // 
            this.lblBombaPrelStatus.AutoSize = true;
            this.lblBombaPrelStatus.Font = new System.Drawing.Font("Segoe UI", 14.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblBombaPrelStatus.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblBombaPrelStatus.Location = new System.Drawing.Point(18, 38);
            this.lblBombaPrelStatus.Name = "lblBombaPrelStatus";
            this.lblBombaPrelStatus.Size = new System.Drawing.Size(41, 25);
            this.lblBombaPrelStatus.TabIndex = 1;
            this.lblBombaPrelStatus.Text = "ON";
            // 
            // lblBombaPrel
            // 
            this.lblBombaPrel.AutoSize = true;
            this.lblBombaPrel.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblBombaPrel.ForeColor = System.Drawing.Color.DarkGray;
            this.lblBombaPrel.Location = new System.Drawing.Point(20, 19);
            this.lblBombaPrel.Name = "lblBombaPrel";
            this.lblBombaPrel.Size = new System.Drawing.Size(102, 15);
            this.lblBombaPrel.TabIndex = 0;
            this.lblBombaPrel.Text = "Bomba Preliminar";
            // 
            // panel7
            // 
            this.panel7.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(20)))), ((int)(((byte)(20)))), ((int)(((byte)(20)))));
            this.panel7.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel7.Controls.Add(this.lblMeta);
            this.panel7.Controls.Add(this.chart1);
            this.panel7.Controls.Add(this.label4);
            this.panel7.Controls.Add(this.label3);
            this.panel7.Location = new System.Drawing.Point(232, 138);
            this.panel7.Name = "panel7";
            this.panel7.Size = new System.Drawing.Size(503, 355);
            this.panel7.TabIndex = 3;
            // 
            // lblMeta
            // 
            this.lblMeta.AutoSize = true;
            this.lblMeta.Font = new System.Drawing.Font("Segoe UI", 9.75F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblMeta.ForeColor = System.Drawing.Color.DarkGray;
            this.lblMeta.Location = new System.Drawing.Point(18, 116);
            this.lblMeta.Name = "lblMeta";
            this.lblMeta.Size = new System.Drawing.Size(94, 17);
            this.lblMeta.TabIndex = 3;
            this.lblMeta.Text = "Meta: 50.00 Pa";
            // 
            // chart1
            // 
            this.chart1.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(20)))), ((int)(((byte)(20)))), ((int)(((byte)(20)))));
            chartArea2.AxisX.LabelStyle.ForeColor = System.Drawing.Color.DarkGray;
            chartArea2.AxisX.LineColor = System.Drawing.Color.FromArgb(((int)(((byte)(40)))), ((int)(((byte)(40)))), ((int)(((byte)(40)))));
            chartArea2.AxisX.MajorGrid.LineColor = System.Drawing.Color.Transparent;
            chartArea2.AxisY.LabelStyle.ForeColor = System.Drawing.Color.DarkGray;
            chartArea2.AxisY.LineColor = System.Drawing.Color.FromArgb(((int)(((byte)(40)))), ((int)(((byte)(40)))), ((int)(((byte)(40)))));
            chartArea2.AxisY.MajorGrid.LineColor = System.Drawing.Color.FromArgb(((int)(((byte)(40)))), ((int)(((byte)(40)))), ((int)(((byte)(40)))));
            chartArea2.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(20)))), ((int)(((byte)(20)))), ((int)(((byte)(20)))));
            chartArea2.Name = "ChartArea1";
            this.chart1.ChartAreas.Add(chartArea2);
            legend2.Enabled = false;
            legend2.Name = "Legend1";
            this.chart1.Legends.Add(legend2);
            this.chart1.Location = new System.Drawing.Point(4, 161);
            this.chart1.Name = "chart1";
            series2.ChartArea = "ChartArea1";
            series2.ChartType = System.Windows.Forms.DataVisualization.Charting.SeriesChartType.Spline;
            series2.Color = System.Drawing.Color.White;
            series2.Legend = "Legend1";
            series2.Name = "Series1";
            this.chart1.Series.Add(series2);
            this.chart1.Size = new System.Drawing.Size(465, 181);
            this.chart1.TabIndex = 2;
            this.chart1.Text = "chart1";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Font = new System.Drawing.Font("Tahoma", 41.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label4.ForeColor = System.Drawing.SystemColors.ControlLightLight;
            this.label4.Location = new System.Drawing.Point(3, 36);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(334, 66);
            this.label4.TabIndex = 1;
            this.label4.Text = "67.6 MBarr";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Font = new System.Drawing.Font("Tahoma", 11.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label3.ForeColor = System.Drawing.Color.FromArgb(((int)(((byte)(90)))), ((int)(((byte)(90)))), ((int)(((byte)(90)))));
            this.label3.Location = new System.Drawing.Point(16, 18);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(195, 18);
            this.label3.TabIndex = 1;
            this.label3.Text = "Pressão Absoluta do Tanque";
            // 
            // label9
            // 
            this.label9.AutoSize = true;
            this.label9.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label9.ForeColor = System.Drawing.Color.DarkGray;
            this.label9.Location = new System.Drawing.Point(17, 291);
            this.label9.Name = "label9";
            this.label9.Size = new System.Drawing.Size(100, 15);
            this.label9.TabIndex = 9;
            this.label9.Text = "Válvula 2: ABERTA";
            // 
            // label10
            // 
            this.label10.AutoSize = true;
            this.label10.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label10.ForeColor = System.Drawing.Color.DarkGray;
            this.label10.Location = new System.Drawing.Point(17, 316);
            this.label10.Name = "label10";
            this.label10.Size = new System.Drawing.Size(100, 15);
            this.label10.TabIndex = 10;
            this.label10.Text = "Válvula 3: ABERTA";
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(10)))), ((int)(((byte)(10)))), ((int)(((byte)(10)))));
            this.ClientSize = new System.Drawing.Size(969, 523);
            this.Controls.Add(this.panel4);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.panel7);
            this.Controls.Add(this.panel5);
            this.Controls.Add(this.panel6);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.Name = "Form1";
            this.Text = "Form1";
            this.panel4.ResumeLayout(false);
            this.panel4.PerformLayout();
            this.panel5.ResumeLayout(false);
            this.panel5.PerformLayout();
            this.panel6.ResumeLayout(false);
            this.panel6.PerformLayout();
            this.panel7.ResumeLayout(false);
            this.panel7.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.chart1)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion
        private System.Windows.Forms.Panel panel4;
        private System.Windows.Forms.Panel panel5;
        private System.Windows.Forms.Panel panel6;
        private System.Windows.Forms.Panel panel7;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.DataVisualization.Charting.Chart chart1;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label lblMeta;

        private System.Windows.Forms.Label lblBombaPrel;
        private System.Windows.Forms.Label lblBombaPrelStatus;
        private System.Windows.Forms.Label lblBombaBooster;
        private System.Windows.Forms.Label lblBombaBoosterStatus;
        private System.Windows.Forms.Label lblBomba1;
        private System.Windows.Forms.Label lblBomba1Status;
        private System.Windows.Forms.Label lblAquecedor;
        private System.Windows.Forms.Label lblAquecedorStatus;
        private System.Windows.Forms.Label lblValvula;

        private System.Windows.Forms.Label lblPressao;
        private System.Windows.Forms.Label lblTempOleo;
        private System.Windows.Forms.Label lblTempoAtuacao;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.Label label7;
        private System.Windows.Forms.Label label8;
        private System.Windows.Forms.Label label10;
        private System.Windows.Forms.Label label9;
    }
}