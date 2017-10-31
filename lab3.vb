Public Class rentalCalculator
    ' Constants
    Const sngDVD As Single = 2.0
    Const sngBLUE_RAY As Single = 2.5
    Const sngNEW_RELEASE_BLUE_RAY As Single = 3.5
    Const sngNEW_RELEASE_DVD As Single = 3.25
    Const sngMEMBER_RATE As Single = 0.1

    ' Globals
    Dim sngOrderTotal As Single = 0.0
    Dim sngDayTotal As Single = 0.0
    Dim intCustomerCount As Integer = 0

    Private Sub resetForm(Optional ByVal strSetting As String = "")
        chkNewRelease.Checked = False
        txtTitle.Clear()
        radDVD.Checked = False
        radBlueRay.Checked = False
        lblItemAmount.Text = ""

        If strSetting = "A" Then ' Reset all of the form.
            chkMember.Checked = False
            chkMember.Enabled = True

            lblOrderTotal.Text = ""
            sngOrderTotal = 0.0
        End If
    End Sub

    Private Sub btnCalculate_Click(sender As Object, e As EventArgs) Handles btnCalculate.Click
        Dim sngItemAmount As Single = 0.0

        ' Check if proper data has been entered into form by user.
        If Not radBlueRay.Checked And Not radDVD.Checked Then
            MessageBox.Show("Movie format missing.", "Error")
            Exit Sub
        End If

        If txtTitle.Text.Trim() = "" Then
            MessageBox.Show("Movie title missing.", "Error")
            Exit Sub
        End If

        ' Calculate the base price given what checkboxes/radio buttons have been selected.
        If chkNewRelease.Checked Then
            ' new release prices
            If radDVD.Checked Then
                sngItemAmount = sngNEW_RELEASE_DVD
            ElseIf radBlueRay.Checked Then
                sngItemAmount = sngNEW_RELEASE_BLUE_RAY
            End If
        Else
            ' non new release prices
            If radDVD.Checked Then
                sngItemAmount = sngDVD
            ElseIf radBlueRay.Checked Then
                sngItemAmount = sngBLUE_RAY
            End If
        End If

        ' If user is a member give them a 10% discount
        If chkMember.Checked Then sngItemAmount -= (sngItemAmount * sngMEMBER_RATE)

        ' Now that final single rental amount is calculated, add to order total.
        sngOrderTotal += sngItemAmount

        ' Only on first movie of order can user set the member checkbox. After that it is disabled.
        If chkMember.Enabled Then chkMember.Enabled = False

        ' Update labels.
        lblItemAmount.Text = sngItemAmount.ToString("c")
        lblOrderTotal.Text = sngOrderTotal.ToString("c")
    End Sub

    Private Sub btnNext_Click(sender As Object, e As EventArgs) Handles btnNext.Click
        resetForm() ' Partial reset of form.
    End Sub

    Private Sub rentalCalculator_Load(sender As Object, e As EventArgs) Handles MyBase.Load
        ' Make sure none of radio buttons are checked on loading up form.
        radDVD.Checked = False
    End Sub

    Private Sub btnComplete_Click(sender As Object, e As EventArgs) Handles btnComplete.Click

        If sngOrderTotal = 0.0 Then
            MessageBox.Show("Cannot make an order with zero rentals.", "Error")
            Exit Sub
        End If

        ' For each completed order add order total to day total, add one to customer count.
        sngDayTotal += sngOrderTotal
        intCustomerCount += 1

        resetForm("A") ' Complete reset of form.
    End Sub

    Private Sub btnSummary_Click(sender As Object, e As EventArgs) Handles btnSummary.Click
        ' Display message box with information regarding number of customers, amount spent on orders, and the current date.
        MessageBox.Show(String.Format("Date: {0}{3}{3}Total: {1}{3}Customers: {2}",
                        Now.ToString("d"), sngDayTotal.ToString("c"), intCustomerCount, Environment.NewLine), "Summary")

        ' Reset variables for customer count and day total
        intCustomerCount = 0
        sngDayTotal = 0.0
    End Sub

    Private Sub btnExit_Click(sender As Object, e As EventArgs) Handles btnExit.Click
        Me.Close()
    End Sub
End Class